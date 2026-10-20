import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cruise, type ICruiseResult, type IForbiddenRuleType } from "dependency-cruiser";
import { afterAll, describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const config = createRequire(import.meta.url)(join(ROOT, ".dependency-cruiser.cjs")) as { forbidden: IForbiddenRuleType[] };

// 反例只写在系统临时目录的最小仓库里，不进仓库
const tmp = mkdtempSync(join(tmpdir(), "exam-prep-layers-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function file(rel: string, text: string): void {
  const p = join(tmp, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}

const UP = "../../../../../";
const CORE = `${UP}packages/domains/plan/core/index.ts`;
const SERVER = `${UP}packages/domains/plan/server/index.ts`;
file("packages/db/src/index.ts", "export const db = 1;\n");
file("packages/domains/plan/core/index.ts", "export const rule = 1;\n");
file("packages/domains/plan/server/index.ts", "export const routes = 1;\n");
file("packages/domains/plan/core/impure.ts", 'import { db } from "../../../db/src/index.ts";\nexport { db };\n');
file("packages/domains/plan/core/io.ts", 'import { readFileSync } from "node:fs";\nexport { readFileSync };\n');
file("packages/domains/learner/core/internal.ts", "export const z = 1;\n");
file("packages/domains/learner/core/index.ts", 'export { z } from "./internal.ts";\n');
file("packages/domains/plan/core/peek.ts", 'import { z } from "../../learner/core/internal.ts";\nexport { z };\n');
file("apps/learner/src/pages/S06/index.ts", `import { rule } from "${CORE}";\nexport { rule };\n`);
file("apps/learner/src/mocks/domains/plan.ts", `import { rule } from "${CORE}";\nexport { rule };\n`);
file("apps/learner/src/mocks/domains/bad.ts", `import { routes } from "${SERVER}";\nexport { routes };\n`);

async function violations(entries: string[]): Promise<{ rule: string; from: string }[]> {
  const options = { baseDir: tmp, validate: true, ruleSet: { forbidden: config.forbidden }, tsPreCompilationDeps: true };
  const result = await cruise(entries, options);
  return (result.output as ICruiseResult).summary.violations.map((v) => ({ rule: v.rule.name, from: v.from }));
}

describe("领域两层的 dependency-cruiser 规则", () => {
  it("页面组件不引用领域包；假数据层只能引用领域 core 的入口", async () => {
    const found = await violations(["apps/learner"]);
    expect(found).toContainEqual({ rule: "ui-pages-no-domains", from: "apps/learner/src/pages/S06/index.ts" });
    expect(found).toContainEqual({ rule: "ui-mocks-domain-core-only", from: "apps/learner/src/mocks/domains/bad.ts" });
    expect(found.filter((v) => v.from === "apps/learner/src/mocks/domains/plan.ts")).toEqual([]);
  });

  it("领域 core 不引用数据库包与 node 内置模块，跨领域只经 core 入口", async () => {
    const names = (await violations(["packages/domains/plan"])).map((v) => v.rule);
    expect(names).toContain("domain-core-pure");
    expect(names).toContain("domain-core-no-node-builtins");
    expect(names).toContain("domains-via-entry");
  });
});
