// pnpm gen 的生成目标。files 类由本包读来源直接生成；tool 类复用令牌、词汇、Orval 与 Prisma 的生成器。
// 生成物都不进 git（.gitignore），由 main.ts 在 dev、test、build、typecheck、lint 之前自动生成。
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { header, literal, normalize, sha12 } from "./emit.ts";
import { Num, parseYaml, type YamlValue } from "./yaml.ts";

export interface Output {
  /** 仓库相对路径。 */
  readonly path: string;
  readonly content: string;
}

/** 本包直接生成的目标：读来源、返回全部输出，不写盘。 */
export interface FileTarget {
  readonly kind: "files";
  readonly name: string;
  readonly title: string;
  readonly generate: (root: string) => Output[];
}

/** 调用外部工具生成的目标：输入文件没变、输出目录没被改动时跳过。 */
export interface ToolTarget {
  readonly kind: "tool";
  readonly name: string;
  readonly title: string;
  /** 决定要不要重跑的输入（仓库相对路径，含工具自身的 package.json，升级工具也会重跑）。 */
  readonly inputs: (root: string) => string[];
  /** 工具写入的目录（仓库相对路径）。 */
  readonly outDir: string;
  /** 只生成部分文件时明确列出，避免把同目录的手写文件算作生成物。 */
  readonly outputs?: readonly string[];
  /** 工具的命令（仓库相对路径）；找不到时提示先 pnpm install。 */
  readonly bin: string;
  readonly run: (root: string) => void;
}

export type Target = FileTarget | ToolTarget;

type Entry = { readonly [key: string]: YamlValue };

function read(root: string, rel: string): string {
  return normalize(readFileSync(join(root, rel), "utf8"));
}

function list(value: YamlValue, where: string): Entry[] {
  if (!Array.isArray(value)) throw new Error(`${where}：应为列表`);
  return value.map((item, i) => record(item, `${where} 第 ${i + 1} 项`));
}

function record(value: YamlValue, where: string): Entry {
  if (value === null || typeof value !== "object" || Array.isArray(value) || value instanceof Num) {
    throw new Error(`${where}：应为键值对`);
  }
  return value;
}

function text(entry: Entry, key: string, where: string): string {
  const value = entry[key];
  if (typeof value !== "string" || value === "") throw new Error(`${where}：${key} 应为非空文字`);
  return value;
}

function strings(value: YamlValue | undefined, where: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) throw new Error(`${where}：应为文字列表`);
  return value as string[];
}

function unique(names: string[], where: string): void {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) throw new Error(`${where}：${name} 重复登记`);
    seen.add(name);
  }
}

function filesIn(root: string, dir: string, ext: string): string[] {
  if (!existsSync(join(root, dir))) return [];
  return readdirSync(join(root, dir))
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => `${dir}/${f}`);
}

const params: FileTarget = {
  kind: "files",
  name: "params",
  title: "参数访问器",
  generate(root) {
    const src = "contracts/params.yaml";
    const source = read(root, src);
    const rows = list(parseYaml(source, src), src).map((e, i) => {
      const where = `${src} 第 ${i + 1} 项`;
      const def = e["default"] ?? null;
      const fields = [
        `owner: ${literal(text(e, "owner", where))}`,
        `default: ${literal(def)}`,
        `range: ${literal(e["range"] ?? null)}`,
        `unit: ${literal(e["unit"] ?? null)}`,
        `tunableBy: ${literal(e["tunable_by"] ?? null)}`,
        `learnerRange: ${literal(e["learner_range"] ?? null)}`,
        `rollout: ${literal(e["rollout"] ?? null)}`,
        `reasonRequired: ${literal(e["reason_required"] ?? null)}`,
        `integer: ${def instanceof Num && def.integer}`,
      ];
      return { name: text(e, "name", where), line: `  ${JSON.stringify(text(e, "name", where))}: { ${fields.join(", ")} },` };
    });
    unique(
      rows.map((r) => r.name),
      src,
    );
    const note = "参数登记的数据与类型；访问器在 packages/params/index.ts（手写）。integer：YAML 默认值为整数时为 true。";
    const body = [
      "export const PARAMS = {",
      ...rows.map((r) => r.line),
      "} as const;",
      "",
      "export type ParamName = keyof typeof PARAMS;",
      "type Widen<T> = T extends number ? number : T extends boolean ? boolean : T extends string ? string :",
      "  T extends readonly (infer U)[] ? Widen<U>[] : T extends object ? { -readonly [P in keyof T]: Widen<T[P]> } : T;",
      'export type ParamValue<K extends ParamName> = Widen<(typeof PARAMS)[K]["default"]>;',
      "",
    ];
    return [{ path: "packages/params/registry.generated.ts", content: header(src, sha12(source), note) + body.join("\n") }];
  },
};

const errors: FileTarget = {
  kind: "files",
  name: "errors",
  title: "错误码",
  generate(root) {
    const src = "contracts/errors.yaml";
    const source = read(root, src);
    const rows = list(parseYaml(source, src), src).map((e, i) => {
      const where = `${src} 第 ${i + 1} 项`;
      const code = text(e, "code", where);
      const status = e["http_status"];
      if (!/^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/.test(code)) throw new Error(`${where}：code 应为“领域前缀_含义”的大写英文`);
      if (!(status instanceof Num) || !status.integer || status.value < 400 || status.value > 599) {
        throw new Error(`${where}：http_status 应为 400–599 的整数`);
      }
      text(e, "owner", where);
      const messageKey = literal(text(e, "message_key", where));
      return { code, line: `  ${JSON.stringify(code)}: { httpStatus: ${status.value}, messageKey: ${messageKey} },` };
    });
    unique(
      rows.map((r) => r.code),
      src,
    );
    const note = "错误码登记：HTTP 状态与文案键；响应体为 {code, message_key, details}（docs/baseline/api-rules.md）。";
    const body = [
      "export const ERROR_CODES = {",
      ...rows.map((r) => r.line),
      "} as const;",
      "",
      "export type ErrorCode = keyof typeof ERROR_CODES;",
      "",
      "/** 是否为 contracts/errors.yaml 登记的错误码。 */",
      "export function isErrorCode(value: unknown): value is ErrorCode {",
      '  return typeof value === "string" && Object.hasOwn(ERROR_CODES, value);',
      "}",
      "",
    ];
    return [{ path: "packages/contract/src/generated/error-codes.ts", content: header(src, sha12(source), note) + body.join("\n") }];
  },
};

const permissions: FileTarget = {
  kind: "files",
  name: "permissions",
  title: "角色与动作",
  generate(root) {
    const src = "contracts/permissions.yaml";
    const source = read(root, src);
    const doc = record(parseYaml(source, src), src);
    const roles = record(doc["roles"] ?? null, `${src} roles`);
    for (const [id, value] of Object.entries(roles)) {
      const role = record(value, `${src} roles.${id}`);
      text(role, "name", `${src} roles.${id}`);
      text(role, "end", `${src} roles.${id}`);
    }
    const actions = list(doc["actions"] ?? null, `${src} actions`).map((e, i) => {
      const where = `${src} actions 第 ${i + 1} 项`;
      const allowed = strings(e["roles"], `${where} roles`);
      for (const role of allowed) if (!Object.hasOwn(roles, role)) throw new Error(`${where}：角色 ${role} 没有在 roles 里登记`);
      return { id: text(e, "id", where), line: `  ${JSON.stringify(text(e, "id", where))}: ${literal(allowed)},` };
    });
    unique(
      actions.map((a) => a.id),
      src,
    );
    const note = "角色与动作：每个动作允许的人类角色（AI 执行者与领域服务的调用方不在这里，见 contracts/ai/actors.yaml）。";
    const body = [
      `export const ROLES = ${literal(Object.keys(roles))} as const;`,
      "",
      "export type Role = (typeof ROLES)[number];",
      "",
      "export const ACTION_ROLES = {",
      ...actions.map((a) => a.line),
      "} as const satisfies Readonly<Record<string, readonly Role[]>>;",
      "",
      "export type ActionId = keyof typeof ACTION_ROLES;",
      "",
      "/** 是否为登记的角色。 */",
      "export function isRole(value: unknown): value is Role {",
      '  return typeof value === "string" && (ROLES as readonly string[]).includes(value);',
      "}",
      "",
      "/** 是否为登记的动作。 */",
      "export function isActionId(value: unknown): value is ActionId {",
      '  return typeof value === "string" && Object.hasOwn(ACTION_ROLES, value);',
      "}",
      "",
      "/** 角色能否执行动作（数据范围由服务端另行校验）。 */",
      "export function roleAllowed(action: ActionId, role: Role): boolean {",
      "  return (ACTION_ROLES[action] as readonly Role[]).includes(role);",
      "}",
      "",
    ];
    return [{ path: "packages/contract/src/generated/permissions.ts", content: header(src, sha12(source), note) + body.join("\n") }];
  },
};

const EVENT_PROPERTY_TYPES = ["string", "uuid", "bool", "int"];

const metrics: FileTarget = {
  kind: "files",
  name: "metrics",
  title: "事件与指标登记",
  generate(root) {
    const out = "packages/domains/metrics/core/generated";
    const evSrc = "contracts/events.yaml";
    const evSource = read(root, evSrc);
    const events = list(parseYaml(evSource, evSrc), evSrc).map((e, i) => {
      const where = `${evSrc} 第 ${i + 1} 项`;
      const props = record(e["properties"] ?? {}, `${where} properties`);
      for (const [k, v] of Object.entries(props)) {
        if (typeof v !== "string" || !EVENT_PROPERTY_TYPES.includes(v)) throw new Error(`${where}：属性 ${k} 的类型不在登记范围内`);
      }
      const version = e["version"];
      if (!(version instanceof Num) || !version.integer) throw new Error(`${where}：version 应为整数`);
      const fields = [
        `owner: ${literal(text(e, "owner", where))}`,
        `source: ${literal(text(e, "source", where))}`,
        `version: ${version.value}`,
        `properties: ${literal(props)}`,
        `status: ${literal(text(e, "status", where))}`,
      ];
      return { name: text(e, "name", where), line: `  ${JSON.stringify(text(e, "name", where))}: { ${fields.join(", ")} },` };
    });
    unique(
      events.map((e) => e.name),
      evSrc,
    );
    const propertyUnion = EVENT_PROPERTY_TYPES.map((t) => JSON.stringify(t)).join(" | ");
    const evNote = "埋点事件登记：source 为 client 的事件由学员端经 trackEvent 上报，为 server 的只由服务端记录。";
    const evBody = [
      `export type EventPropertyType = ${propertyUnion};`,
      "",
      "export interface EventEntry {",
      "  readonly owner: string;",
      '  readonly source: "client" | "server";',
      "  readonly version: number;",
      "  readonly properties: Readonly<Record<string, EventPropertyType>>;",
      '  readonly status: "active" | "retired";',
      "}",
      "",
      "export const EVENTS = {",
      ...events.map((e) => e.line),
      "} as const satisfies Readonly<Record<string, EventEntry>>;",
      "",
      "export type EventName = keyof typeof EVENTS;",
      "",
    ];
    const mSrc = "contracts/metrics.yaml";
    const mSource = read(root, mSrc);
    const rows = list(parseYaml(mSource, mSrc), mSrc).map((e, i) => {
      const where = `${mSrc} 第 ${i + 1} 项`;
      const fields = [
        `name: ${literal(text(e, "name", where))}`,
        `owner: ${literal(text(e, "owner", where))}`,
        `formulaRef: ${literal(e["formula_ref"] ?? null)}`,
        `unit: ${literal(e["unit"] ?? null)}`,
        `refresh: ${literal(e["refresh"] ?? null)}`,
        `shownOn: ${literal(e["shown_on"] ?? [])}`,
        `minSample: ${literal(e["min_sample"] ?? null)}`,
        `target: ${literal(e["target"] ?? null)}`,
      ];
      return { id: text(e, "id", where), line: `  ${JSON.stringify(text(e, "id", where))}: { ${fields.join(", ")} },` };
    });
    unique(
      rows.map((r) => r.id),
      mSrc,
    );
    const mNote = "指标口径登记：名称、归属、口径出处、单位、刷新方式、展示页、最小样本与目标值。";
    const mBody = [
      "export const METRICS = {",
      ...rows.map((r) => r.line),
      "} as const;",
      "",
      "export type MetricId = keyof typeof METRICS;",
      "",
    ];
    return [
      { path: `${out}/events.ts`, content: header(evSrc, sha12(evSource), evNote) + evBody.join("\n") },
      { path: `${out}/metrics.ts`, content: header(mSrc, sha12(mSource), mNote) + mBody.join("\n") },
    ];
  },
};

const pages: FileTarget = {
  kind: "files",
  name: "pages",
  title: "学员端页面清单",
  generate(root) {
    const dir = "design/screens/learner";
    const files = filesIn(root, dir, ".yaml");
    if (files.length === 0) throw new Error(`${dir}：没有页面登记文件`);
    const sources = files.map((f) => read(root, f));
    const entries = files.map((f, i) => record(parseYaml(sources[i] ?? "", f), f)).filter((e) => e["removed"] !== true);
    const modes = new Set<string>();
    const lines = entries.map((e, i) => {
      const where = files[i] ?? dir;
      const mode = text(e, "mode", where);
      modes.add(mode);
      const views = (Array.isArray(e["views"]) ? list(e["views"], `${where} views`) : []).map((v) => {
        const viewMode = typeof v["mode"] === "string" ? v["mode"] : mode;
        modes.add(viewMode);
        return `{ id: ${literal(text(v, "id", where))}, mode: ${literal(viewMode)} }`;
      });
      const fields = `id: ${literal(text(e, "id", where))}, title: ${literal(text(e, "title", where))}, mode: ${literal(mode)}`;
      return `  { ${fields}, views: [${views.join(", ")}] },`;
    });
    unique(
      entries.map((e, i) => text(e, "id", files[i] ?? dir)),
      dir,
    );
    const modeUnion = [...modes]
      .sort()
      .map((m) => JSON.stringify(m))
      .join(" | ");
    const note = "学员端页面清单：页面 ID、标题、模式与各视图的 ID 和模式（视图未写模式时取页面模式）。";
    const body = [
      `export type PageMode = ${modeUnion};`,
      "",
      "export interface PageView {",
      "  readonly id: string;",
      "  readonly mode: PageMode;",
      "}",
      "",
      "export interface PageEntry {",
      "  readonly id: string;",
      "  readonly title: string;",
      "  readonly mode: PageMode;",
      "  readonly views: readonly PageView[];",
      "}",
      "",
      "export const PAGES = [",
      ...lines,
      "] as const satisfies readonly PageEntry[];",
      "",
      'export type PageId = (typeof PAGES)[number]["id"];',
      "",
    ];
    const content = header(`${dir}/*.yaml`, sha12(sources.join("")), note) + body.join("\n");
    return [{ path: "apps/learner/src/generated/pages.ts", content }];
  },
};

const PRISMA_SCALARS = new Set(["String", "Boolean", "Int", "BigInt", "Float", "Decimal", "DateTime", "Json", "Bytes"]);

interface PrismaModel {
  readonly name: string;
  readonly file: string;
  readonly doc: string[];
  readonly body: string[];
}

/** 读多文件 Prisma schema 里的模型（含 /// 文档注释里的 @owner、@append_only、@tenant_scoped）与枚举名。 */
export function readPrismaModels(root: string, dir: string): { models: PrismaModel[]; enums: Set<string> } {
  const models: PrismaModel[] = [];
  const enums = new Set<string>();
  for (const file of filesIn(root, dir, ".prisma")) {
    const lines = read(root, file).split("\n");
    let doc: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const t = (lines[i] ?? "").trim();
      if (t.startsWith("///")) {
        doc.push(t.slice(3).trim());
        continue;
      }
      const block = /^(model|enum)\s+(\w+)\s*\{$/.exec(t);
      if (!block) {
        if (t !== "") doc = [];
        continue;
      }
      const body: string[] = [];
      while (i + 1 < lines.length && (lines[i + 1] ?? "").trim() !== "}") body.push((lines[++i] ?? "").trim());
      i++;
      if (block[1] === "enum") enums.add(block[2] ?? "");
      else models.push({ name: block[2] ?? "", file, doc, body });
      doc = [];
    }
  }
  return { models, enums };
}

const models: FileTarget = {
  kind: "files",
  name: "models",
  title: "表元数据",
  generate(root) {
    const dir = "packages/db/prisma/schema";
    const files = filesIn(root, dir, ".prisma");
    const { models: found, enums } = readPrismaModels(root, dir);
    if (found.length === 0) throw new Error(`${dir}：没有找到模型`);
    const modelNames = new Set(found.map((m) => m.name));
    const sorted = [...found].sort((a, b) => (a.name < b.name ? -1 : 1));
    const lines = sorted.map((m) => {
      const owner = m.doc.map((d) => /^@owner\s+(\S+)/.exec(d)?.[1]).find(Boolean);
      if (!owner) throw new Error(`${m.file} 的 ${m.name}：缺少 /// @owner <领域>`);
      const table = m.body.map((b) => /^@@map\("([^"]+)"\)/.exec(b)?.[1]).find(Boolean) ?? m.name;
      const scalars: string[] = [];
      const keys: { [key: string]: YamlValue } = {};
      for (const b of m.body) {
        const compound = /^@@(?:id|unique)\(\s*(?:fields:\s*)?\[([^\]]*)\](.*)\)$/.exec(b);
        if (compound) {
          const cols = (compound[1] ?? "").split(",").map((c) => c.trim().replace(/\(.*$/, ""));
          const named = /name:\s*"([^"]+)"/.exec(compound[2] ?? "")?.[1];
          if (cols.length > 1) keys[named ?? cols.join("_")] = cols;
          continue;
        }
        const field = /^(\w+)\s+([A-Za-z]\w*)/.exec(b);
        if (!field || b.startsWith("@@") || b.startsWith("//")) continue;
        const type = field[2] ?? "";
        if (PRISMA_SCALARS.has(type) || enums.has(type) || type === "Unsupported") scalars.push(field[1] ?? "");
        else if (!modelNames.has(type)) throw new Error(`${m.file} 的 ${m.name}.${field[1]}：未知类型 ${type}`);
      }
      const flags = `tenantScoped: ${m.doc.includes("@tenant_scoped")}, appendOnly: ${m.doc.includes("@append_only")}`;
      const fields = `table: ${literal(table)}, owner: ${literal(owner)}, ${flags}, scalarFields: ${literal(scalars)}`;
      return `  ${m.name}: { ${fields}, compoundKeys: ${literal(keys)} },`;
    });
    const note = "表的元数据：模型名 → 表名、归属领域、是否按租户隔离、是否只追加。";
    const body = ["export const MODELS = {", ...lines, "} as const;", "", "export type ModelName = keyof typeof MODELS;", ""];
    const sha = sha12(files.map((f) => read(root, f)).join(""));
    return [{ path: "packages/db/src/generated/models.ts", content: header(`${dir}/*.prisma`, sha, note) + body.join("\n") }];
  },
};

function exec(root: string, command: string, args: string[], title: string): void {
  const r = spawnSync(command, args, { cwd: root, encoding: "utf8", env: process.env });
  if (r.status !== 0) {
    const tail = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(-30).join("\n");
    throw new Error(`${title}失败（退出码 ${r.status ?? r.signal}）：\n${tail}`);
  }
}

/** 递归列出目录下某种扩展名的文件（仓库相对路径，排好序）。 */
function filesUnder(root: string, dir: string, ext: string): string[] {
  if (!existsSync(join(root, dir))) return [];
  return readdirSync(join(root, dir))
    .sort()
    .flatMap((name) => {
      const rel = `${dir}/${name}`;
      if (statSync(join(root, rel)).isDirectory()) return filesUnder(root, rel, ext);
      return name.endsWith(ext) ? [rel] : [];
    });
}

/** 接口契约合并（F04）：contracts/openapi/ 分文件 → 一份 OpenAPI 与接口一览，Orval 读前者。 */
const openapi: ToolTarget = {
  kind: "tool",
  name: "openapi",
  title: "接口契约合并",
  inputs: (root) => [
    ...filesUnder(root, "contracts/openapi", ".yaml"),
    "contracts/permissions.yaml",
    "contracts/errors.yaml",
    "tools/merge-openapi.mjs",
    "packages/contract/src/openapi-merge.ts",
    "packages/codegen/src/yaml.ts",
  ],
  outDir: "packages/contract/src/generated",
  outputs: ["packages/contract/src/generated/openapi.json", "packages/contract/src/generated/operations.ts"],
  bin: "tools/merge-openapi.mjs",
  run: (root) => exec(root, process.execPath, ["tools/merge-openapi.mjs"], "接口契约合并"),
};

const orval: ToolTarget = {
  kind: "tool",
  name: "orval",
  title: "接口代码（Orval）",
  inputs: () => [
    "packages/contract/src/generated/openapi.json",
    "orval.config.ts",
    "scripts/engineering/contract-gen.mjs",
    "node_modules/orval/package.json",
  ],
  outDir: "packages/contract/src/generated/api",
  bin: "node_modules/.bin/orval",
  run: (root) => exec(root, process.execPath, ["scripts/engineering/contract-gen.mjs"], "接口代码生成"),
};

/** 学员端与机构端假数据层的 MSW 浏览器工作线程（F04）：从本仓库安装的 msw 复制到 public/，版本跟着依赖走，不进 git。 */
const MSW_WORKER_SOURCE = "packages/contract/node_modules/msw/lib/mockServiceWorker.js";
const MSW_WORKER_TARGETS = ["apps/learner/public/mockServiceWorker.js", "apps/org/public/mockServiceWorker.js"] as const;

const mswWorker: ToolTarget = {
  kind: "tool",
  name: "msw",
  title: "MSW 浏览器工作线程",
  inputs: () => ["packages/contract/node_modules/msw/package.json"],
  outDir: "apps/learner/public",
  outputs: MSW_WORKER_TARGETS,
  bin: MSW_WORKER_SOURCE,
  run: (root) => {
    for (const target of MSW_WORKER_TARGETS) {
      mkdirSync(dirname(join(root, target)), { recursive: true });
      copyFileSync(join(root, MSW_WORKER_SOURCE), join(root, target));
    }
  },
};

const prisma: ToolTarget = {
  kind: "tool",
  name: "prisma",
  title: "Prisma 客户端",
  inputs: (root) => [...filesIn(root, "packages/db/prisma/schema", ".prisma"), "prisma.config.ts", "node_modules/prisma/package.json"],
  outDir: "packages/db/generated/prisma",
  bin: "node_modules/.bin/prisma",
  run: (root) => exec(root, join(root, "node_modules/.bin/prisma"), ["generate"], "Prisma 客户端生成"),
};

const tokens: ToolTarget = {
  kind: "tool",
  name: "tokens",
  title: "设计令牌",
  inputs: () => [
    "design/tokens.json",
    "design/tokens.resolver.json",
    "packages/ui/scripts/gen-tokens.ts",
    "packages/ui/scripts/tokens-build.ts",
  ],
  outDir: "packages/ui/src/generated",
  outputs: ["packages/ui/src/generated/tokens.css", "packages/ui/src/generated/tailwind-theme.css"],
  bin: "packages/ui/scripts/gen-tokens.ts",
  run: (root) => exec(root, process.execPath, ["packages/ui/scripts/gen-tokens.ts"], "设计令牌生成"),
};

const vocab: ToolTarget = {
  kind: "tool",
  name: "vocab",
  title: "词汇常量",
  inputs: () => ["docs/product/glossary.yaml", "tools/gen-vocab.ts", "packages/codegen/src/yaml.ts"],
  outDir: "packages/shared/src/vocab",
  outputs: ["packages/shared/src/vocab/glossary.generated.ts"],
  bin: "tools/gen-vocab.ts",
  run: (root) => exec(root, process.execPath, ["tools/gen-vocab.ts"], "词汇常量生成"),
};

/** 按顺序执行：错误码在接口代码之前（请求函数引用错误码）；契约先合并，Orval 再读合并结果。 */
export const TARGETS: readonly Target[] = [
  params,
  errors,
  permissions,
  metrics,
  pages,
  models,
  tokens,
  vocab,
  openapi,
  orval,
  mswWorker,
  prisma,
];

/** 文件名（不含扩展名），一致性检查用。 */
export function stem(path: string): string {
  return basename(path).replace(/\.[^.]+$/, "");
}
