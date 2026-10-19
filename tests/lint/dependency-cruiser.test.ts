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
const tmp = mkdtempSync(join(tmpdir(), "exam-prep-depcruise-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function file(rel: string, text: string): void {
  const p = join(tmp, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}

file("packages/params/index.ts", 'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n');
file("packages/ui/src/index.ts", 'import { read } from "../../params/index.ts";\nexport { read };\n');
file("packages/db/src/index.ts", "export const db = 1;\n");
file("apps/learner/src/main.ts", 'import { db } from "../../../packages/db/src/index.ts";\nexport { db };\n');
file("packages/domains/metrics/src/internal.ts", "export const z = 1;\n");
file("packages/domains/metrics/src/index.ts", 'export { z } from "./internal.ts";\n');
file("packages/domains/platform/src/index.ts", 'import { z } from "../../metrics/src/internal.ts";\nexport { z };\n');

async function violated(entries: string[]): Promise<string[]> {
  const result = await cruise(entries, {
    baseDir: tmp,
    validate: true,
    ruleSet: { forbidden: config.forbidden },
    tsPreCompilationDeps: true,
  });
  return (result.output as ICruiseResult).summary.violations.map((v) => v.rule.name);
}

describe("dependency-cruiser 规则的反例", () => {
  it("packages/ui 不依赖 params、contract、domains、db、ai", async () => {
    expect(await violated(["packages/ui"])).toContain("ui-isolated");
  });

  it("界面应用只依赖 packages/ui、contract、params", async () => {
    expect(await violated(["apps/learner"])).toContain("ui-apps-allowed-packages");
  });

  it("领域之间只经包入口，方向按 docs/product/domain-map.yaml", async () => {
    const names = await violated(["packages/domains/platform"]);
    expect(names).toContain("domains-via-entry");
    expect(names).toContain("domain-direction-platform");
  });

  it("@exam-prep/params 的主入口不引入 node 内置模块", async () => {
    expect(await violated(["packages/params"])).toContain("params-no-node-builtins");
  });
});
