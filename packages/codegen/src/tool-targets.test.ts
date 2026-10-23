import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "exam-prep-codegen-tools-"));
const outputs = [
  "packages/ui/src/generated/tokens.css",
  "packages/ui/src/generated/tailwind-theme.css",
  "packages/shared/src/vocab/glossary.generated.ts",
];
const sources = [
  "packages/codegen/src/main.ts",
  "packages/codegen/src/targets.ts",
  "packages/codegen/src/emit.ts",
  "packages/codegen/src/yaml.ts",
  "packages/ui/scripts/gen-tokens.ts",
  "packages/ui/scripts/tokens-build.ts",
  "tools/gen-vocab.ts",
  "design/tokens.json",
  "design/tokens.resolver.json",
  "docs/product/glossary.yaml",
];
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function fixture(): string {
  const root = mkdtempSync(join(tmp, "repo-"));
  for (const rel of sources) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    cpSync(join(ROOT, rel), join(root, rel));
  }
  writeFileSync(join(root, "package.json"), '{"type":"module"}\n');
  return root;
}

function generate(root: string, check = false) {
  return spawnSync(process.execPath, ["packages/codegen/src/main.ts", "--only=tokens,vocab", ...(check ? ["--check"] : [])], {
    cwd: root,
    encoding: "utf8",
  });
}

function hashes(root: string): string[] {
  return outputs.map((rel) =>
    createHash("sha256")
      .update(readFileSync(join(root, rel)))
      .digest("hex"),
  );
}

function expectSuccess(result: ReturnType<typeof generate>): void {
  expect(result.stderr).toBe("");
  expect(result.status, result.stdout).toBe(0);
}

describe("pnpm gen 接管令牌与词汇生成", () => {
  it("冷启动没有生成目录时也能生成全部输出，重复执行与检查都稳定", () => {
    const root = fixture();
    for (const rel of outputs) expect(existsSync(join(root, rel))).toBe(false);
    expectSuccess(generate(root));
    for (const rel of outputs) expect(existsSync(join(root, rel))).toBe(true);
    const first = hashes(root);
    expectSuccess(generate(root));
    expectSuccess(generate(root, true));
    expect(hashes(root)).toEqual(first);
  });

  it("生成目录和文件被删除后，检查只报错，普通生成能完整重建", () => {
    const root = fixture();
    expectSuccess(generate(root));
    const first = hashes(root);
    rmSync(join(root, "packages/ui/src/generated"), { recursive: true });
    rmSync(join(root, "packages/shared/src/vocab/glossary.generated.ts"));
    const check = generate(root, true);
    expect(check.status).toBe(1);
    expect(check.stdout).toContain("packages/ui/src/generated");
    expect(check.stdout).toContain("packages/shared/src/vocab");
    for (const rel of outputs) expect(existsSync(join(root, rel))).toBe(false);
    expectSuccess(generate(root));
    expect(hashes(root)).toEqual(first);
    expectSuccess(generate(root, true));
  });

  it("来源改变时检查失败且不写生成物，重新生成后检查通过", () => {
    const root = fixture();
    expectSuccess(generate(root));
    const first = hashes(root);
    appendFileSync(join(root, "design/tokens.json"), "\n");
    appendFileSync(join(root, "docs/product/glossary.yaml"), "\n");
    const check = generate(root, true);
    expect(check.status).toBe(1);
    expect(check.stdout).toContain("packages/ui/src/generated");
    expect(check.stdout).toContain("packages/shared/src/vocab");
    expect(hashes(root)).toEqual(first);
    expectSuccess(generate(root));
    expect(hashes(root)).not.toEqual(first);
    expectSuccess(generate(root, true));
  });

  it("词汇目录的手写文件不属于生成输出，修改它们不会使生成物过期", () => {
    const root = fixture();
    expectSuccess(generate(root));
    const first = hashes(root);
    writeFileSync(join(root, "packages/shared/src/vocab/index.ts"), "export const handWritten = true;\n");
    expectSuccess(generate(root, true));
    expect(hashes(root)).toEqual(first);
  });
});

const mswSource = "packages/contract/node_modules/msw/lib/mockServiceWorker.js";
const mswOutputs = ["apps/learner/public/mockServiceWorker.js", "apps/org/public/mockServiceWorker.js"] as const;
const mswStamps = ".cache/codegen/stamps.json";

function mswFixture(): string {
  const root = fixture();
  for (const rel of ["packages/contract/node_modules/msw/package.json", mswSource]) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    cpSync(join(ROOT, rel), join(root, rel));
  }
  return root;
}

function generateMsw(root: string, check = false) {
  return spawnSync(process.execPath, ["packages/codegen/src/main.ts", "--only=msw", ...(check ? ["--check"] : [])], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("pnpm gen 接管 MSW 浏览器工作线程", () => {
  it("没有 public 目录和缓存时一次生成学员端与机构端，字节均与已安装来源一致", () => {
    const root = mswFixture();
    for (const rel of mswOutputs) expect(existsSync(dirname(join(root, rel)))).toBe(false);
    expect(existsSync(join(root, mswStamps))).toBe(false);
    expectSuccess(generateMsw(root));
    const source = readFileSync(join(root, mswSource));
    for (const rel of mswOutputs) expect(readFileSync(join(root, rel))).toEqual(source);
    expect(existsSync(join(root, mswStamps))).toBe(true);
  });

  it("重复生成与检查都成功，两个工作线程和缓存内容保持不变", () => {
    const root = mswFixture();
    expectSuccess(generateMsw(root));
    const first = mswOutputs.map((rel) => readFileSync(join(root, rel)));
    const stamps = readFileSync(join(root, mswStamps));
    expectSuccess(generateMsw(root));
    expectSuccess(generateMsw(root, true));
    expect(mswOutputs.map((rel) => readFileSync(join(root, rel)))).toEqual(first);
    expect(readFileSync(join(root, mswStamps))).toEqual(stamps);
  });

  it("只删除机构端工作线程时检查失败且不写盘，保留学员端与缓存并可重新生成", () => {
    const root = mswFixture();
    expectSuccess(generateMsw(root));
    const learner = readFileSync(join(root, mswOutputs[0]));
    const stamps = readFileSync(join(root, mswStamps));
    rmSync(join(root, mswOutputs[1]));
    const check = generateMsw(root, true);
    expect(check.status).toBe(1);
    expect(check.stdout).toContain("生成物检查：1 处不一致");
    expect(existsSync(join(root, mswOutputs[1]))).toBe(false);
    expect(readFileSync(join(root, mswOutputs[0]))).toEqual(learner);
    expect(readFileSync(join(root, mswStamps))).toEqual(stamps);
    expectSuccess(generateMsw(root));
    const source = readFileSync(join(root, mswSource));
    for (const rel of mswOutputs) expect(readFileSync(join(root, rel))).toEqual(source);
    expectSuccess(generateMsw(root, true));
  });
});
