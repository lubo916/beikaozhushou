// pnpm gen：生成物的唯一入口（docs/baseline/tech.md「生成物」）。生成物不进 git，dev、test、build、typecheck、lint 之前自动运行。
// 用法：node packages/codegen/src/main.ts [--check] [--only=params,errors,...]
//   --check  只比对、不写盘：本包生成的逐字比对；Orval、Prisma 看输入与输出是否和上次生成时一致。不一致时退出码 1。
//   --only   只跑列出的目标（镜像构建只生成服务端需要的部分；一致性测试只跑不需要依赖的部分）。
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TARGETS, type FileTarget, type ToolTarget } from "./targets.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const STAMPS = join(ROOT, ".cache/codegen/stamps.json");

interface Stamp {
  readonly inputs: string;
  readonly outputs: string;
}

function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

function readText(rel: string): string | null {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

function listDir(rel: string): string[] {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return [];
  return readdirSync(p)
    .sort()
    .flatMap((name) => (statSync(join(p, name)).isDirectory() ? listDir(`${rel}/${name}`) : [`${rel}/${name}`]));
}

function digest(paths: string[]): string {
  const hash = createHash("sha256");
  for (const rel of paths) hash.update(`${rel}\n${readText(rel) ?? "<缺失>"}\n`);
  return hash.digest("hex");
}

function loadStamps(): Record<string, Stamp> {
  const text = readText(".cache/codegen/stamps.json");
  return text ? (JSON.parse(text) as Record<string, Stamp>) : {};
}

/** 本包生成：内容不同才写盘；返回过期（或刚更新）的文件。 */
function runFiles(target: FileTarget, check: boolean): string[] {
  const stale = target.generate(ROOT).filter((o) => readText(o.path) !== o.content);
  if (!check) {
    for (const o of stale) {
      mkdirSync(dirname(join(ROOT, o.path)), { recursive: true });
      writeFileSync(join(ROOT, o.path), o.content);
    }
  }
  return stale.map((o) => o.path);
}

/** 工具生成：输入与输出都和上次一致时跳过；返回过期（或刚更新）的目录。 */
function runTool(target: ToolTarget, check: boolean, stamps: Record<string, Stamp>): string[] {
  const inputs = digest(target.inputs(ROOT));
  const files = listDir(target.outDir);
  const prev = stamps[target.name];
  if (files.length > 0 && prev?.inputs === inputs && prev.outputs === digest(files)) return [];
  if (check) return [target.outDir];
  if (!existsSync(join(ROOT, target.bin))) throw new Error(`${target.title}：找不到 ${target.bin}，先运行 pnpm install`);
  target.run(ROOT);
  stamps[target.name] = { inputs: digest(target.inputs(ROOT)), outputs: digest(listDir(target.outDir)) };
  return [target.outDir];
}

function main(argv: string[]): number {
  const check = argv.includes("--check");
  const only = argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
  const names = only ? new Set(only.split(",").filter(Boolean)) : null;
  const unknown = names ? [...names].filter((n) => !TARGETS.some((t) => t.name === n)) : [];
  if (unknown.length) throw new Error(`没有这些生成目标：${unknown.join("、")}（可选：${TARGETS.map((t) => t.name).join("、")}）`);
  const started = Date.now();
  const stamps = loadStamps();
  let fresh = 0;
  const stale: string[] = [];
  for (const target of TARGETS) {
    if (names && !names.has(target.name)) continue;
    const changed = target.kind === "files" ? runFiles(target, check) : runTool(target, check, stamps);
    if (changed.length === 0) fresh++;
    else if (check) stale.push(...changed);
    else say(`✓ ${target.title}：已更新 ${changed.join("、")}`);
  }
  if (check) {
    for (const path of stale) say(`✗ ${path} 与来源不一致（过期或被手改），运行 pnpm gen`);
    say(stale.length ? `生成物检查：${stale.length} 处不一致` : "生成物检查：全部与来源一致");
    return stale.length ? 1 : 0;
  }
  mkdirSync(dirname(STAMPS), { recursive: true });
  writeFileSync(STAMPS, `${JSON.stringify(stamps, null, 2)}\n`);
  say(`pnpm gen：${fresh} 项已是最新（${((Date.now() - started) / 1000).toFixed(1)} 秒）`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`pnpm gen 失败：${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
