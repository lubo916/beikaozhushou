import { describe, expect, it } from "vitest";
import config from "../../../orval.config.ts";
import { normalizeSchemas } from "./openapi-normalize.ts";

type Transformer = (input: unknown) => unknown;
interface Spec {
  paths: Record<string, Record<string, { responses: Record<string, { content?: Record<string, { schema: unknown }> }> }>>;
}

/** 隔离的小契约：一个没写 items 的数组响应（V3 题目选项就是这样写的），一个 x-internal 接口。 */
const ISOLATED = {
  openapi: "3.1.0",
  info: { title: "t", version: "1" },
  paths: {
    "/options": {
      get: {
        operationId: "getOptions",
        responses: { "200": { description: "ok", content: { "application/json": { schema: { type: "array" } } } } },
      },
    },
    "/internal": { post: { operationId: "postInternal", "x-internal": true, responses: { "202": { description: "ok" } } } },
  },
};

describe("Orval 输入的规范化（orval.config.ts）", () => {
  it("type: array 没写 items 时补 items: {}（任意元素），嵌在属性和数组里的也补", () => {
    expect(normalizeSchemas({ type: "array" })).toEqual({ type: "array", items: {} });
    const nested = { type: "object", properties: { options: { type: "array" }, grid: { type: "array", items: { type: "array" } } } };
    const expected = {
      type: "object",
      properties: { options: { type: "array", items: {} }, grid: { type: "array", items: { type: "array", items: {} } } },
    };
    expect(normalizeSchemas(nested)).toEqual(expected);
  });

  it("type: object 没写 properties 与 additionalProperties 时补 additionalProperties: true；已经写了的不动", () => {
    expect(normalizeSchemas({ type: "object" })).toEqual({ type: "object", additionalProperties: true });
    const strict = { type: "object", additionalProperties: false };
    expect(normalizeSchemas(strict)).toEqual(strict);
    const typed = { type: "array", items: { type: "string" } };
    expect(normalizeSchemas(typed)).toEqual(typed);
  });

  it("钩子与 Zod 两套生成的输入都经过规范化：隔离契约里没写 items 的数组补上 items，x-internal 接口不生成", () => {
    const projects = config as unknown as Record<string, { input: { override: { transformer: Transformer } } }>;
    for (const name of ["hooks", "zod"]) {
      const transform = projects[name]?.input.override.transformer;
      expect(typeof transform, `${name} 没有输入转换`).toBe("function");
      const out = transform?.(ISOLATED) as Spec;
      const schema = out.paths["/options"]?.["get"]?.responses["200"]?.content?.["application/json"]?.schema;
      expect(schema).toEqual({ type: "array", items: {} });
      expect(Object.keys(out.paths)).toEqual(["/options"]);
    }
  });
});
