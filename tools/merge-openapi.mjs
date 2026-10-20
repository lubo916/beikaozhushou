#!/usr/bin/env node
// 接口契约合并（api-rules 第 2 节，F04）：contracts/openapi/ 的 _common.yaml、schemas/、paths/、pages/ 合成一份 OpenAPI，
// 写到 packages/contract/src/generated/openapi.json（交给 Orval）与 operations.ts（接口一览：方法、路径、领域、动作、影响的数据）。
// 路径、operationId 或形状名重复直接报错。由 pnpm gen 调用（packages/codegen 的 openapi 目标），也可单独运行：node tools/merge-openapi.mjs
// 不引入第三方库：YAML 用 packages/codegen 的解析器，合并规则在 packages/contract/src/openapi-merge.ts（有测试）。
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml, plain } from "../packages/codegen/src/yaml.ts";
import { mergeOpenapi, renderOperations } from "../packages/contract/src/openapi-merge.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SOURCE_DIR = "contracts/openapi";
const COMMON = `${SOURCE_DIR}/_common.yaml`;

/** 两个生成物（不进 git）。 */
export const OUTPUTS = Object.freeze({
  spec: "packages/contract/src/generated/openapi.json",
  operations: "packages/contract/src/generated/operations.ts",
});

const normalize = (text) => text.replace(/\r\n?/g, "\n");
const readText = (root, rel) => normalize(readFileSync(join(root, rel), "utf8"));
const readYaml = (root, rel) => plain(parseYaml(readText(root, rel), rel));

function yamlFiles(root, rel) {
  const dir = join(root, rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const child = `${rel}/${name}`;
      if (statSync(join(root, child)).isDirectory()) return yamlFiles(root, child);
      return name.endsWith(".yaml") ? [child] : [];
    });
}

/** 合并契约（不写盘）：返回合并结果、参与合并的文件与来源摘要。 */
export function buildContract(root = ROOT) {
  const all = yamlFiles(root, SOURCE_DIR);
  if (!all.includes(COMMON)) throw new Error(`找不到 ${COMMON}`);
  const sources = [COMMON, ...all.filter((rel) => rel !== COMMON)];
  const files = sources.slice(1).map((path) => ({ path, doc: readYaml(root, path) }));
  const permissions = readYaml(root, "contracts/permissions.yaml");
  const errors = readYaml(root, "contracts/errors.yaml");
  const domains = join(root, "packages/domains");
  const owners = readdirSync(domains).filter((name) => statSync(join(domains, name)).isDirectory());
  const actions = (Array.isArray(permissions?.actions) ? permissions.actions : []).map((a) => a?.id).filter((id) => typeof id === "string");
  const codes = (Array.isArray(errors) ? errors : []).map((e) => e?.code).filter((code) => typeof code === "string");
  const result = mergeOpenapi({ path: COMMON, doc: readYaml(root, COMMON) }, files, { owners, actions, errors: codes });
  const hash = createHash("sha256");
  for (const rel of sources) hash.update(`${rel}\n${readText(root, rel)}\n`);
  return { result, sources, sha: hash.digest("hex").slice(0, 12) };
}

/** 合并并写出两个生成物；内容没变就不写。 */
export function writeContract(root = ROOT) {
  const { result, sha } = buildContract(root);
  const outputs = [
    [OUTPUTS.spec, `${JSON.stringify(result.spec, null, 2)}\n`],
    [OUTPUTS.operations, renderOperations(result, sha)],
  ];
  for (const [rel, content] of outputs) {
    const path = join(root, rel);
    if (existsSync(path) && readFileSync(path, "utf8") === content) continue;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return { operations: result.operations.length, outputs: outputs.map(([rel]) => rel) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const { operations, outputs } = writeContract();
    process.stdout.write(`契约合并：${operations} 个接口 → ${outputs.join("、")}\n`);
  } catch (error) {
    process.stderr.write(`契约合并失败：${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
