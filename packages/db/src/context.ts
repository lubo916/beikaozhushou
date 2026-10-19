import type { Role } from "@exam-prep/contract/permissions";
import { getPrisma, type PrismaClient } from "./client.ts";
import { MODELS, type ModelName } from "./generated/models.ts";

/** 当前请求的身份：0 期为固定开发者身份（apps/api/src/context.ts 挂到每个请求），接入登录后来自会话。 */
export interface RequestContext {
  readonly learnerId: string;
  readonly tenantId: string;
  readonly role: Role;
  readonly guest: boolean;
  readonly timezone: string;
}

/** 越过租户边界的读写在发出查询之前被拒绝（ADR-028 决定 1：第一道防线）。 */
export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantScopeError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertContext(ctx: RequestContext): void {
  if (!UUID_RE.test(ctx.tenantId)) throw new TenantScopeError(`租户 ID 不是 UUID：${ctx.tenantId}`);
  if (!UUID_RE.test(ctx.learnerId)) throw new TenantScopeError(`学员 ID 不是 UUID：${ctx.learnerId}`);
  if (ctx.guest !== (ctx.role === "guest")) throw new TenantScopeError("guest 应由 role 推出（role 为 guest 时 guest 为 true）");
}

type Args = Record<string, unknown>;

interface ModelPolicy {
  readonly scopeField: "tenant_id" | "id";
  readonly scalarFields: readonly string[];
  readonly compoundKeys: Readonly<Record<string, readonly string[] | undefined>>;
}

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);
const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);
const UPDATE_OPS = new Set(["update", "updateMany", "updateManyAndReturn"]);
const LOGICAL_KEYS = new Set(["AND", "OR", "NOT"]);
const SELECT_KEYS = ["select", "omit", "_count", "_sum", "_avg", "_min", "_max"] as const;

function isRecord(value: unknown): value is Args {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function policyFor(model: ModelName): ModelPolicy {
  const meta = MODELS[model];
  // 租户表以自身 id 隔离。没有 tenant_id 的关联表不能从上下文客户端直接访问。
  if (!meta || (!meta.tenantScoped && model !== "Tenant")) throw new TenantScopeError(`模型 ${model} 没有可用的租户隔离规则`);
  return { scopeField: model === "Tenant" ? "id" : "tenant_id", scalarFields: meta.scalarFields, compoundKeys: meta.compoundKeys };
}

function assertScalarFields(value: unknown, policy: ModelPolicy, label: string, allowAll = false): void {
  if (!isRecord(value)) throw new TenantScopeError(`${label}应为对象`);
  for (const field of Object.keys(value)) {
    if (allowAll && field === "_all") continue;
    if (!policy.scalarFields.includes(field)) throw new TenantScopeError(`${label}不能使用关系字段 ${field}；请分开执行带上下文的模型操作`);
  }
}

function assertWhere(where: unknown, policy: ModelPolicy): void {
  if (where === undefined) return;
  if (!isRecord(where)) throw new TenantScopeError("查询条件应为对象");
  for (const [field, value] of Object.entries(where)) {
    if (LOGICAL_KEYS.has(field)) {
      for (const child of Array.isArray(value) ? value : [value]) assertWhere(child, policy);
    } else if (policy.scalarFields.includes(field)) {
      // JSON 路径、JSON 值和标量筛选交给 Prisma；这里不递归检查字段的值。
      continue;
    } else if (policy.compoundKeys[field]) {
      assertScalarFields(value, policy, "复合唯一条件");
    } else {
      throw new TenantScopeError(`查询条件不能使用关系字段 ${field}；请分开执行带上下文的模型操作`);
    }
  }
}

function scopeWhere(where: unknown, tenantId: string, policy: ModelPolicy): Args {
  assertWhere(where, policy);
  const scoped: Args = isRecord(where) ? { ...where } : {};
  if (policy.scopeField in scoped && scoped[policy.scopeField] !== tenantId) throw new TenantScopeError("查询条件指定了其他租户");
  scoped[policy.scopeField] = tenantId;
  return scoped;
}

function scopeData(data: unknown, tenantId: string, policy: ModelPolicy): Args {
  assertScalarFields(data, policy, "写入数据");
  const scoped: Args = { ...(data as Args) };
  if (policy.scopeField in scoped && scoped[policy.scopeField] !== tenantId) throw new TenantScopeError("写入数据指定了其他租户");
  scoped[policy.scopeField] = tenantId;
  return scoped;
}

function guardUpdate(data: unknown, tenantId: string, policy: ModelPolicy): void {
  assertScalarFields(data, policy, "修改数据");
  const value = (data as Args)[policy.scopeField];
  if (value !== undefined && value !== tenantId && !(isRecord(value) && Object.keys(value).length === 1 && value["set"] === tenantId)) {
    throw new TenantScopeError("不能把记录移到其他租户");
  }
}

function guardReadOptions(args: Args, policy: ModelPolicy, operation: string): void {
  if (args["include"] !== undefined) throw new TenantScopeError("上下文客户端不能展开关系；请分开执行带上下文的模型查询");
  for (const key of SELECT_KEYS) {
    const value = args[key];
    if (value === undefined || typeof value === "boolean") continue;
    assertScalarFields(value, policy, "选择字段", key === "_count" || (operation === "count" && key === "select"));
  }
  const orderBy = args["orderBy"];
  if (orderBy !== undefined) {
    for (const order of Array.isArray(orderBy) ? orderBy : [orderBy]) {
      if (!isRecord(order)) throw new TenantScopeError("排序字段应为对象");
      for (const [field, value] of Object.entries(order)) {
        if (["_count", "_sum", "_avg", "_min", "_max"].includes(field)) assertScalarFields(value, policy, "聚合排序字段");
        else assertScalarFields({ [field]: value }, policy, "排序字段");
      }
    }
  }
  if (args["cursor"] !== undefined) assertWhere(args["cursor"], policy);
}

/**
 * 给按租户隔离的表的一次操作加上当前租户：读、改、删的条件补 tenant_id，写入补 tenant_id，
 * 租户表用自身 id 隔离。关系展开、关系筛选、嵌套写入与没有隔离规则的模型均拒绝；
 * 关系操作由领域分开执行带上下文的模型查询，不能依赖尚未启用的数据库行级安全。
 */
export function applyTenantScope(model: ModelName, operation: string, args: unknown, tenantId: string): Args {
  const policy = policyFor(model);
  if (!WHERE_OPS.has(operation) && !CREATE_OPS.has(operation)) throw new TenantScopeError(`不支持的模型操作：${operation}`);
  const scoped: Args = isRecord(args) ? { ...args } : {};
  guardReadOptions(scoped, policy, operation);
  if (WHERE_OPS.has(operation)) scoped["where"] = scopeWhere(scoped["where"], tenantId, policy);
  if (scoped["cursor"] !== undefined) scoped["cursor"] = scopeWhere(scoped["cursor"], tenantId, policy);
  if (CREATE_OPS.has(operation)) {
    const data = scoped["data"];
    scoped["data"] = Array.isArray(data) ? data.map((row: unknown) => scopeData(row, tenantId, policy)) : scopeData(data, tenantId, policy);
  }
  if (UPDATE_OPS.has(operation)) guardUpdate(scoped["data"], tenantId, policy);
  if (operation === "upsert") {
    scoped["create"] = scopeData(scoped["create"], tenantId, policy);
    guardUpdate(scoped["update"], tenantId, policy);
  }
  return scoped;
}

function rejectRaw(): never {
  throw new TenantScopeError("withContext 中不能执行原始 SQL：按租户隔离的读写经模型方法");
}

/** 带当前租户的客户端：按 generated/models.ts 的 tenantScoped 给表加租户条件，原始 SQL 一律拒绝。 */
export function scopedClient(client: PrismaClient, ctx: RequestContext) {
  const tenantId = ctx.tenantId;
  return client.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!(model in MODELS)) throw new TenantScopeError(`未知模型：${model}`);
          return query(applyTenantScope(model as ModelName, operation, args, tenantId) as typeof args);
        },
      },
      $queryRaw: rejectRaw,
      $executeRaw: rejectRaw,
      $queryRawUnsafe: rejectRaw,
      $executeRawUnsafe: rejectRaw,
    },
  });
}

export type ScopedDb = ReturnType<typeof scopedClient>;

/** 所有业务读写的入口（ADR-028 决定 1）：校验身份后，以带当前租户的客户端执行 fn。 */
export async function withContext<T>(
  ctx: RequestContext,
  fn: (db: ScopedDb, ctx: RequestContext) => Promise<T>,
  client: PrismaClient = getPrisma(),
): Promise<T> {
  assertContext(ctx);
  return fn(scopedClient(client, ctx), ctx);
}
