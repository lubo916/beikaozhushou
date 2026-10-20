// Orval（0.1b 计划 C6）：合并后的契约 → packages/contract/src/generated/api/（类型、TanStack Query 钩子、MSW 模拟与 Zod 结构）。
// 契约分文件写在 contracts/openapi/，由 tools/merge-openapi.mjs 合成 packages/contract/src/generated/openapi.json（F04）。
// 由 pnpm contract:gen 运行（scripts/engineering/contract-gen.mjs 加生成物头并写清单），不直接调用 orval。
import { defineConfig, type InputTransformerFn } from "orval";
import { normalizeSchemas } from "./packages/contract/src/openapi-normalize.ts";

const INPUT = "./packages/contract/src/generated/openapi.json";
const OUT = "./packages/contract/src/generated/api";
const METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);

// 生成的 MSW 假数据里 format: date 的写法：Orval 默认用 split("T")[0]，在 noUncheckedIndexedAccess 下推断成 string | undefined，
// 不能赋给必填的日期字段；改成一定是字符串的 slice(0, 10)。
// Orval 只把这个函数的源码写进 endpoints.msw.ts（那里自己引入 faker），配置里不执行它。
declare const faker: { date: { past(): Date } };
const DATE_MOCK = () => faker.date.past().toISOString().slice(0, 10);

/** 不对端开放的接口（x-internal: true）不生成客户端代码。 */
const dropInternal: InputTransformerFn = (input) => {
  const spec = normalizeSchemas(input) as typeof input;
  const paths: NonNullable<typeof spec.paths> = {};
  for (const [route, item] of Object.entries(spec.paths ?? {})) {
    if (!item) continue;
    const kept = Object.fromEntries(
      Object.entries(item).filter(([key, op]) => !(METHODS.has(key) && (op as { "x-internal"?: boolean })["x-internal"] === true)),
    );
    if (Object.keys(kept).some((key) => METHODS.has(key))) paths[route] = kept;
  }
  return { ...spec, paths };
};

export default defineConfig({
  hooks: {
    input: { target: INPUT, override: { transformer: (spec) => dropInternal(spec) } },
    output: {
      tsconfig: "./packages/contract/tsconfig.json",
      mode: "split",
      target: `${OUT}/endpoints.ts`,
      client: "react-query",
      httpClient: "fetch",
      mock: { type: "msw", delay: false },
      prettier: true,
      override: {
        mutator: { path: "./packages/contract/src/fetcher.ts", name: "customFetch" },
        fetch: { includeHttpResponseReturnType: false },
        mock: { required: true, numberMin: 0, numberMax: 1000, format: { date: DATE_MOCK } },
      },
    },
  },
  zod: {
    input: { target: INPUT, override: { transformer: (spec) => dropInternal(spec) } },
    output: {
      packageJson: "./packages/contract/package.json",
      tsconfig: "./packages/contract/tsconfig.json",
      mode: "single",
      client: "zod",
      target: `${OUT}/endpoints.zod.ts`,
      prettier: true,
    },
  },
});
