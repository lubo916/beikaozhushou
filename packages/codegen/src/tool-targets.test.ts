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
