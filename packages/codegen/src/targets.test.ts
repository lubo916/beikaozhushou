import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { MARK } from "./emit.ts";
import { TARGETS, type FileTarget } from "./targets.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FILE_TARGETS = TARGETS.filter((t): t is FileTarget => t.kind === "files");
const tmp = mkdtempSync(join(tmpdir(), "exam-prep-codegen-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function target(name: string): FileTarget {
  const found = FILE_TARGETS.find((t) => t.name === name);
  if (!found) throw new Error(`没有生成目标 ${name}`);
  return found;
}

describe("pnpm gen 的生成目标", () => {
  it("在仓库数据上都能跑通：输出稳定、带生成物头", () => {
    expect(FILE_TARGETS.map((t) => t.name)).toEqual(["params", "errors", "permissions", "metrics", "pages", "models"]);
    for (const t of FILE_TARGETS) {
      const first = t.generate(ROOT);
      expect(first.length).toBeGreaterThan(0);
      expect(t.generate(ROOT)).toEqual(first);
      for (const output of first) expect(output.content.startsWith(`// ${MARK}`)).toBe(true);
    }
  });

  it("参数：YAML 默认值写成整数的才标 integer，1.0 这类小数原样保留", () => {
    const [output] = target("params").generate(ROOT);
    expect(output?.content).toMatch(/"api\.page\.max_limit": \{[^\n]*integer: true \},/);
    expect(output?.content).toMatch(/"learner\.mastery\.level_thresholds": \{ [^\n]*default: \[1\.0, 2\.5,[^\n]*integer: false \},/);
  });

  it("权限：动作引用了没登记的角色时报错", () => {
    cpSync(join(ROOT, "contracts/permissions.yaml"), join(tmp, "contracts/permissions.yaml"));
    const yaml = "roles:\n  learner: {name: 学员, end: learner}\nactions:\n  - id: a.b\n    roles: [nobody]\n";
    writeFileSync(join(tmp, "contracts/permissions.yaml"), yaml);
    expect(() => target("permissions").generate(tmp)).toThrow(/nobody/);
  });

  it("错误码：HTTP 状态不在 400–599 时报错", () => {
    cpSync(join(ROOT, "contracts/errors.yaml"), join(tmp, "contracts/errors.yaml"));
    writeFileSync(join(tmp, "contracts/errors.yaml"), "- code: COMMON_X\n  owner: platform\n  http_status: 200\n  message_key: error.x\n");
    expect(() => target("errors").generate(tmp)).toThrow(/http_status/);
  });
});
