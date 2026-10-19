import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function ruleIds(code: string, file: string): Promise<(string | null)[]> {
  const eslint = new ESLint({ cwd: ROOT });
  const [result] = await eslint.lintText(code, { filePath: resolve(ROOT, file) });
  return (result?.messages ?? []).map((m) => m.ruleId);
}

describe("ESLint 规则的反例（反例只在内存中构造，不进仓库）", () => {
  it("界面应用禁用全局 fetch，只经 packages/contract 的钩子访问接口", async () => {
    expect(await ruleIds('export const load = () => fetch("/api/params");\n', "apps/learner/src/counterexample.ts")).toContain(
      "no-restricted-globals",
    );
    expect(await ruleIds('export const load = () => window.fetch("/api/params");\n', "apps/org/src/counterexample.ts")).toContain(
      "no-restricted-properties",
    );
  });

  it("界面应用不能引用数据库包、领域包与禁用的请求库", async () => {
    expect(
      await ruleIds('import { withContext } from "@exam-prep/db";\nexport { withContext };\n', "apps/admin/src/counterexample.ts"),
    ).toContain("no-restricted-imports");
    expect(await ruleIds('import axios from "axios";\nexport { axios };\n', "apps/learner/src/counterexample.ts")).toContain(
      "no-restricted-imports",
    );
  });

  it("全仓禁用 ADR-025 列出的库与 console", async () => {
    expect(
      await ruleIds('import moment from "moment";\nexport { moment };\n', "packages/domains/platform/src/counterexample.ts"),
    ).toContain("no-restricted-imports");
    expect(await ruleIds('console.log("x");\n', "apps/api/src/counterexample.ts")).toContain("no-console");
  });

  it("React Router 只用声明式路由", async () => {
    expect(
      await ruleIds(
        'import { createBrowserRouter } from "react-router";\nexport { createBrowserRouter };\n',
        "apps/learner/src/counterexample.tsx",
      ),
    ).toContain("no-restricted-imports");
  });

  it("packages/contract 的请求函数可以用 fetch", async () => {
    expect(await ruleIds('export const load = () => fetch("/api/params");\n', "packages/contract/src/counterexample.ts")).not.toContain(
      "no-restricted-globals",
    );
  });
});
