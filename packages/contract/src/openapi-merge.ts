// 接口契约合并（api-rules 第 2 节，F04）：以 contracts/openapi/_common.yaml 为底稿，并入 schemas/、paths/、pages/ 下的文件，
// 合成一份 OpenAPI 交给 Orval。路径、operationId 或形状名重复直接报错；也检查引用、所属领域、权限动作、错误码与 x-invalidates。
// 纯函数：读文件、解析 YAML 与写盘由 tools/merge-openapi.mjs 做，测试直接调用这里。

export type HttpMethod = "GET" | "PUT" | "POST" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS" | "TRACE";

const METHODS = ["get", "put", "post", "delete", "patch", "head", "options", "trace"] as const;
const COMPONENT_KINDS: readonly string[] = ["schemas", "parameters", "responses", "requestBodies", "headers"];
const OPERATION_ID_RE = /^[a-z][A-Za-z0-9]*$/;
const PAGE_FILE_RE = /\/pages\/([^/]+)\.yaml$/;
const PAGE_ID_RE = /^[SOP]\d{2}$/;
const LOCAL_REF_RE = /^#\/components\/([^/]+)\/([^/]+)$/;

export interface ContractFile {
  /** 仓库相对路径，如 contracts/openapi/schemas/exam.yaml。 */
  readonly path: string;
  /** 解析后的 YAML。 */
  readonly doc: unknown;
}

export interface MergeOptions {
  /** 合法的领域名（packages/domains 下的目录名）。 */
  readonly owners: readonly string[];
  /** contracts/permissions.yaml 登记的动作。 */
  readonly actions: readonly string[];
  /** contracts/errors.yaml 登记的错误码。 */
  readonly errors: readonly string[];
}

export interface OperationInfo {
  readonly operationId: string;
  readonly method: HttpMethod;
  /** 不含前缀的路径模板，如 /exams/{examId}/map。 */
  readonly path: string;
  readonly owner: string;
  readonly action: string;
  readonly isPublic: boolean;
  readonly internal: boolean;
  /** 写操作会影响哪些接口的数据（x-invalidates）。 */
  readonly invalidates: readonly string[];
  readonly file: string;
}

export interface MergeResult {
  readonly spec: Record<string, unknown>;
  readonly operations: readonly OperationInfo[];
  /** 接口前缀（servers 第一项），如 /api/v1。 */
  readonly basePath: string;
}

export class ContractError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`接口契约有 ${problems.length} 处问题：\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ContractError";
    this.problems = problems;
  }
}

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function collectRefs(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, out);
  } else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (key === "$ref" && typeof item === "string") out.add(item);
      else collectRefs(item, out);
    }
  }
  return out;
}

/** 合并契约；有问题时一次列出全部问题（ContractError）。 */
export function mergeOpenapi(common: ContractFile, files: readonly ContractFile[], options: MergeOptions): MergeResult {
  if (!isRecord(common.doc)) throw new ContractError([`${common.path}：应为键值对`]);
  const base = common.doc;
  const problems: string[] = [];
  const servers = base["servers"];
  const firstServer: unknown = Array.isArray(servers) ? servers[0] : undefined;
  const url = isRecord(firstServer) ? firstServer["url"] : undefined;
  const basePath = typeof url === "string" ? url : "";
  if (!basePath.startsWith("/")) problems.push(`${common.path}：servers 第一项的 url 应为接口前缀（如 /api/v1）`);

  const paths: Json = {};
  const pathFile = new Map<string, string>();
  const components: Record<string, Json> = {};
  const componentFile = new Map<string, string>();
  const operations: OperationInfo[] = [];
  const operationFile = new Map<string, string>();

  const addComponents = (file: ContractFile, value: unknown, pageId: string | null): void => {
    if (value === undefined) return;
    if (!isRecord(value)) {
      problems.push(`${file.path}：components 应为键值对`);
      return;
    }
    for (const [kind, entries] of Object.entries(value)) {
      if (!COMPONENT_KINDS.includes(kind)) {
        problems.push(`${file.path}：components 下不认识 ${kind}（只用 ${COMPONENT_KINDS.join("、")}）`);
        continue;
      }
      if (!isRecord(entries)) {
        problems.push(`${file.path}：components.${kind} 应为键值对`);
        continue;
      }
      const bucket = (components[kind] ??= {});
      for (const [name, def] of Object.entries(entries)) {
        const key = `${kind}/${name}`;
        const previous = componentFile.get(key);
        if (previous !== undefined) {
          problems.push(`形状名重复：components.${kind}.${name} 同时写在 ${previous} 与 ${file.path}`);
          continue;
        }
        if (pageId !== null && kind === "schemas" && !name.startsWith(pageId)) {
          problems.push(`${file.path}：页面私有形状 ${name} 要以页 ID ${pageId} 开头（公共形状放 schemas/）`);
        }
        componentFile.set(key, file.path);
        bucket[name] = def;
      }
    }
  };

  const addPaths = (file: ContractFile, value: unknown): void => {
    if (value === undefined) return;
    if (!isRecord(value)) {
      problems.push(`${file.path}：paths 应为键值对`);
      return;
    }
    for (const [route, item] of Object.entries(value)) {
      const previous = pathFile.get(route);
      if (previous !== undefined) {
        problems.push(`路径重复：${route} 同时写在 ${previous} 与 ${file.path}（同一路径的各个方法写在一个文件里）`);
        continue;
      }
      if (!route.startsWith("/")) problems.push(`${file.path}：路径 ${route} 应以 / 开头（前缀写在 _common.yaml 的 servers 里）`);
      if (!isRecord(item)) {
        problems.push(`${file.path}：${route} 应为键值对`);
        continue;
      }
      pathFile.set(route, file.path);
      paths[route] = item;
      for (const method of METHODS) {
        const op = item[method];
        if (op === undefined) continue;
        const where = `${file.path} 的 ${method.toUpperCase()} ${route}`;
        if (!isRecord(op)) {
          problems.push(`${where}：应为键值对`);
          continue;
        }
        const id = op["operationId"];
        if (typeof id !== "string" || !OPERATION_ID_RE.test(id)) {
          problems.push(`${where}：operationId 要写成 camelCase 的动宾结构`);
          continue;
        }
        const previousOp = operationFile.get(id);
        if (previousOp !== undefined) {
          problems.push(`operationId 重复：${id} 同时写在 ${previousOp} 与 ${file.path}`);
          continue;
        }
        operationFile.set(id, file.path);
        const owner = op["x-owner"];
        if (typeof owner !== "string" || !options.owners.includes(owner)) {
          problems.push(`${where}：x-owner 要写所属领域（packages/domains 下的目录名），现在是 ${String(owner)}`);
        }
        const action = op["x-action"];
        if (typeof action !== "string" || !options.actions.includes(action)) {
          problems.push(`${where}：x-action 要写 contracts/permissions.yaml 登记的动作，现在是 ${String(action)}`);
        }
        for (const code of strings(op["x-errors"])) {
          if (!options.errors.includes(code)) problems.push(`${where}：x-errors 里的 ${code} 没有在 contracts/errors.yaml 登记`);
        }
        operations.push({
          operationId: id,
          method: method.toUpperCase() as HttpMethod,
          path: route,
          owner: typeof owner === "string" ? owner : "",
          action: typeof action === "string" ? action : "",
          isPublic: op["x-public"] === true,
          internal: op["x-internal"] === true,
          invalidates: strings(op["x-invalidates"]),
          file: file.path,
        });
      }
    }
  };

  addComponents(common, base["components"], null);
  addPaths(common, base["paths"]);
  for (const file of files) {
    if (!isRecord(file.doc)) {
      problems.push(`${file.path}：应为键值对`);
      continue;
    }
    const extra = Object.keys(file.doc).filter((key) => key !== "paths" && key !== "components");
    if (extra.length > 0) problems.push(`${file.path}：只能写 paths 与 components（多了 ${extra.join("、")}）`);
    const page = PAGE_FILE_RE.exec(file.path)?.[1];
    if (page !== undefined && !PAGE_ID_RE.test(page)) problems.push(`${file.path}：pages/ 下的文件名要用页 ID（如 S06.yaml）`);
    addComponents(file, file.doc["components"], page ?? null);
    addPaths(file, file.doc["paths"]);
  }

  const known = new Set(operations.map((op) => op.operationId));
  for (const op of operations) {
    for (const target of op.invalidates) {
      if (!known.has(target)) problems.push(`${op.file} 的 ${op.operationId}：x-invalidates 里的 ${target} 不是已有接口`);
    }
  }
  const spec: Json = { ...base, paths, components };
  for (const ref of collectRefs(spec)) {
    const match = LOCAL_REF_RE.exec(ref);
    const kind = match?.[1];
    const name = match?.[2];
    if (kind === undefined || name === undefined) problems.push(`引用 ${ref}：只用本契约内的 #/components/<类>/<名>`);
    else if (components[kind]?.[name] === undefined) problems.push(`引用 ${ref} 找不到对应的形状`);
  }
  if (problems.length > 0) throw new ContractError([...new Set(problems)]);
  return { spec, operations, basePath };
}

const quote = (text: string): string => JSON.stringify(text);

/** 接口一览（packages/contract/src/generated/operations.ts）的内容。 */
export function renderOperations(result: MergeResult, sourceSha: string): string {
  const rows = [...result.operations]
    .sort((a, b) => (a.operationId < b.operationId ? -1 : a.operationId > b.operationId ? 1 : 0))
    .map((op) => {
      const fields = [
        `method: ${quote(op.method)}`,
        `path: ${quote(op.path)}`,
        `owner: ${quote(op.owner)}`,
        `action: ${quote(op.action)}`,
        `isPublic: ${op.isPublic}`,
        `internal: ${op.internal}`,
        `invalidates: [${op.invalidates.map(quote).join(", ")}]`,
      ];
      return `  ${op.operationId}: { ${fields.join(", ")} },`;
    });
  return [
    `// GENERATED by tools/merge-openapi.mjs，来源 contracts/openapi/；勿手改（改契约后运行 pnpm gen）。source-sha: ${sourceSha}`,
    "",
    "/** 接口前缀（_common.yaml 的 servers 第一项）。 */",
    `export const API_PREFIX = ${quote(result.basePath)};`,
    "",
    "/** 每个接口的方法、路径模板、所属领域、权限动作与会影响哪些接口的数据（x-invalidates）；假数据层与数据刷新按 operationId 查。 */",
    "export const OPERATIONS = {",
    ...rows,
    "} as const;",
    "",
    "export type OperationId = keyof typeof OPERATIONS;",
    "",
  ].join("\n");
}
