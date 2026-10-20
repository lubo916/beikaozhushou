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

const useCore = 'import { rule } from "@exam-prep/domain-plan/core";\nexport { rule };\n';
const useServer = 'import { routes } from "@exam-prep/domain-plan/server";\nexport { routes };\n';

describe("领域两层的 ESLint 规则（反例只在内存中构造，不进仓库）", () => {
  it("页面组件不引用领域包", async () => {
    expect(await ruleIds(useCore, "apps/learner/src/pages/S06/index.tsx")).toContain("no-restricted-imports");
  });

  it("假数据层可以引用领域的 core 入口，不能引用 server", async () => {
    expect(await ruleIds(useCore, "apps/learner/src/mocks/domains/plan.ts")).not.toContain("no-restricted-imports");
    expect(await ruleIds(useServer, "apps/learner/src/mocks/domains/plan.ts")).toContain("no-restricted-imports");
  });

  it("领域 core 不引用服务端依赖、数据库包、server 层与 node 内置模块", async () => {
    const file = "packages/domains/plan/core/counterexample.ts";
    const banned = ["fastify", "@exam-prep/db", "@exam-prep/domain-learner/server", "../server/index.ts", "node:fs", "@exam-prep/contract"];
    for (const from of banned) {
      expect(await ruleIds(`import * as x from "${from}";\nexport { x };\n`, file)).toContain("no-restricted-imports");
    }
    expect(await ruleIds('import { ApiError } from "@exam-prep/contract/errors";\nexport { ApiError };\n', file)).not.toContain(
      "no-restricted-imports",
    );
  });

  it("领域 core 不写裸数字（阈值经参数访问器读），server 层不受这条限制", async () => {
    const code = "export const overdue = (days: number) => days > 7;\n";
    expect(await ruleIds(code, "packages/domains/plan/core/counterexample.ts")).toContain("@typescript-eslint/no-magic-numbers");
    expect(await ruleIds(code, "packages/domains/plan/server/counterexample.ts")).not.toContain("@typescript-eslint/no-magic-numbers");
  });

  it("领域 core 与 packages/shared 不读运行环境全局量", async () => {
    const code = "export const env = () => process.env;\n";
    expect(await ruleIds(code, "packages/domains/plan/core/counterexample.ts")).toContain("no-restricted-globals");
    expect(await ruleIds(code, "packages/shared/src/today/counterexample.ts")).toContain("no-restricted-globals");
  });
});
