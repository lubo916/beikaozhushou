// 仓库级检查（F03）：在 pnpm test 里运行（vitest 的 node 项目收 packages/**/*.test.ts）。
// 1. 令牌生成物与 design/tokens.json 一致；2. 词汇常量与 docs/product/glossary.yaml 一致；
// 3. 界面代码（TSX）里不硬写状态名、档位名；4. 文案里没有宣传禁用语与禁用同义词；5. 文案里没有裸数字（规则数字用 {{占位符}}）。
// 整合任务可以把 3–5 挪进 pnpm lint（F03 交接单「风险与提醒」）。
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findBareNumbers } from "@exam-prep/shared/format";
import { findForbiddenWords, findHardcodedTerms } from "@exam-prep/shared/vocab";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const APPS = ["learner", "org", "admin"];

/** 确属非规则数字的文案（如年份、型号）：写“文件#键”并注明理由。目前没有。 */
const DIGITS_ALLOWED: ReadonlySet<string> = new Set<string>();

function walk(dir: string, accept: (path: string) => boolean): string[] {
  if (!existsSync(join(ROOT, dir))) return [];
  return readdirSync(join(ROOT, dir))
    .sort()
    .flatMap((name) => {
      const rel = `${dir}/${name}`;
      if (name === "node_modules" || name === "generated") return [];
      if (statSync(join(ROOT, rel)).isDirectory()) return walk(rel, accept);
      return accept(rel) ? [rel] : [];
    });
}

const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const isSourceTsx = (path: string) => path.endsWith(".tsx") && !path.endsWith(".test.tsx") && !path.endsWith("/testing.tsx");

function copyFiles(): string[] {
  return [...APPS.flatMap((app) => walk(`apps/${app}/src/i18n`, (path) => path.endsWith(".json"))), "packages/ui/src/copy.zh-CN.json"];
}

function copyStrings(value: unknown, path: readonly string[] = []): { key: string; text: string }[] {
  if (typeof value === "string") return [{ key: path.join("."), text: value }];
  if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([key, child]) => copyStrings(child, [...path, key]));
  return [];
}

function runCheck(script: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [script, "--check"], { cwd: ROOT, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe("仓库级检查（F03）", () => {
  it("令牌生成物与 design/tokens.json 一致（不一致时运行 node packages/ui/scripts/gen-tokens.ts）", () => {
    const result = runCheck("packages/ui/scripts/gen-tokens.ts");
    expect(result.output).toContain("已是最新");
    expect(result.status).toBe(0);
  });

  it("词汇常量与 docs/product/glossary.yaml 一致（不一致时运行 node tools/gen-vocab.ts）", () => {
    const result = runCheck("tools/gen-vocab.ts");
    expect(result.output).toContain("已是最新");
    expect(result.status).toBe(0);
  });

  it("界面代码里不硬写状态名、档位名（叫法从 @exam-prep/shared/vocab 或文案文件取；确需写出的行加 vocab-exempt: 理由）", () => {
    const files = [...APPS.flatMap((app) => walk(`apps/${app}/src`, isSourceTsx)), ...walk("packages/ui/src", isSourceTsx)];
    expect(files.length).toBeGreaterThan(0);
    const found = files.flatMap((file) => findHardcodedTerms(read(file)).map((hit) => `${file}:${hit.line} 写死了“${hit.term}”`));
    expect(found).toEqual([]);
  });

  it("文案里没有宣传禁用语与禁用同义词（vocabulary.md 第 11 节）", () => {
    const found = copyFiles().flatMap((file) =>
      copyStrings(JSON.parse(read(file))).flatMap(({ key, text }) =>
        findForbiddenWords(text).map((hit) => `${file}#${key}：“${hit.word}”${hit.use ? `，改用“${hit.use}”` : ""}`),
      ),
    );
    expect(found).toEqual([]);
  });

  it("文案里没有裸数字：规则数字一律用 {{占位符}}，取值由页面经参数访问器读（ui-rules 第 6 节）", () => {
    const found = copyFiles().flatMap((file) =>
      copyStrings(JSON.parse(read(file)))
        .filter(({ key }) => !DIGITS_ALLOWED.has(`${file}#${key}`))
        .flatMap(({ key, text }) => findBareNumbers(text).map((digits) => `${file}#${key}：“${digits}”`)),
    );
    expect(found).toEqual([]);
  });
});
