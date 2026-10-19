// Orval（0.1b 计划 C6）：contracts/openapi.yaml → packages/contract/src/generated/api/（类型、TanStack Query 钩子、MSW 模拟与 Zod 结构）。
// 由 pnpm contract:gen 运行（scripts/engineering/contract-gen.mjs 加生成物头并写清单），不直接调用 orval。
import { defineConfig, type InputTransformerFn } from "orval";

const INPUT = "./contracts/openapi.yaml";
const OUT = "./packages/contract/src/generated/api";
const METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);

/** 将 OpenAPI 3.1 的自由对象、无元素约束数组展开为 Orval 7 可生成的等价形式。 */
function normalizeSchemas(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeSchemas);
  if (value === null || typeof value !== "object") return value;
  const normalized = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeSchemas(item)]));
  if (normalized["type"] === "array" && !("items" in normalized)) normalized["items"] = {};
  if (normalized["type"] === "object" && !("properties" in normalized) && !("additionalProperties" in normalized)) {
    normalized["additionalProperties"] = true;
  }
  return normalized;
}

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
        mock: { required: true, numberMin: 0, numberMax: 1000 },
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
