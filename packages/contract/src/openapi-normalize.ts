// Orval 输入的规范化（orval.config.ts 用；F04 从配置里拆出来，便于单独测试）：OpenAPI 3.1 允许 type: array 不写 items、
// type: object 不写 properties，Orval 7 要显式写出——补成等价形式（items: {} 即任意元素，additionalProperties: true 即任意字段），
// 生成的 Zod 照样接受任意 JSON。
export function normalizeSchemas(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeSchemas);
  if (value === null || typeof value !== "object") return value;
  const normalized = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeSchemas(item)]));
  if (normalized["type"] === "array" && !("items" in normalized)) normalized["items"] = {};
  if (normalized["type"] === "object" && !("properties" in normalized) && !("additionalProperties" in normalized)) {
    normalized["additionalProperties"] = true;
  }
  return normalized;
}
