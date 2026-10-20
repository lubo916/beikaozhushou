// 学员端假数据接口（api-rules 第 4、5 节）：一个 handle 接住 /api/v1 下的全部请求——先按 ?state= 统一处理强制状态，
// 再看所属领域是否走真接口（VITE_REAL），最后交给自动注册的假数据路由；写操作按 Idempotency-Key 只算一次（并发的也算）。
// 纯逻辑，不依赖 MSW：浏览器里由 @exam-prep/contract/mock-browser 接到 Service Worker，测试直接调用。
import { ApiError, isApiError } from "@exam-prep/contract/errors";
import type { MockOutcome, MockRequest } from "@exam-prep/contract/mock-browser";
import { API_PREFIX, OPERATIONS, type OperationId } from "@exam-prep/contract/operations";
import type { DevControl } from "./control.ts";
import type { MockDb } from "./db.ts";
import type { MockContext, MockRoute, VariantState } from "./route.ts";

interface CompiledOperation {
  readonly id: OperationId;
  readonly method: string;
  readonly owner: string;
  readonly internal: boolean;
  readonly pattern: RegExp;
  readonly names: readonly string[];
}

export interface MockApiOptions {
  readonly db: MockDb;
  readonly control: DevControl;
  readonly routes: readonly MockRoute[];
}

export interface MockApi {
  readonly handle: (request: MockRequest) => Promise<MockOutcome>;
}

const WRITE_METHODS: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const VARIANT_STATES: readonly string[] = ["empty", "insufficient_data", "restricted", "locked"];
const STATUS_OK = 200;
const STATUS_NO_CONTENT = 204;
const PARAM_SEGMENT = /^\{(\w+)\}$/;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");

function compile(): CompiledOperation[] {
  return (Object.keys(OPERATIONS) as OperationId[]).map((id) => {
    const op = OPERATIONS[id];
    const names: string[] = [];
    const source = op.path
      .split("/")
      .map((segment) => {
        const param = PARAM_SEGMENT.exec(segment)?.[1];
        if (param === undefined) return escapeRegExp(segment);
        names.push(param);
        return "([^/]+)";
      })
      .join("/");
    return { id, method: op.method, owner: op.owner, internal: op.internal, pattern: new RegExp(`^${source}$`), names };
  });
}

function errorOutcome(error: ApiError): MockOutcome {
  return { kind: "json", status: error.status, body: error.toBody(), headers: {} };
}

/** 空态的通用写法：分页列表（响应里有 items）给空列表；其他接口用路由的 empty 写法，没写就照常返回。 */
function emptyPage(body: unknown): unknown {
  const items = typeof body === "object" && body !== null ? (body as Record<string, unknown>)["items"] : undefined;
  return Array.isArray(items) ? { ...(body as object), items: [], next_cursor: null } : body;
}

export function createMockApi({ db, control, routes }: MockApiOptions): MockApi {
  const operations = compile();
  const byId = new Map<OperationId, MockRoute>(routes.map((route) => [route.operationId, route]));

  const find = (method: string, path: string) => {
    for (const op of operations) {
      if (op.method !== method) continue;
      const match = op.pattern.exec(path);
      if (match === null) continue;
      const params: Record<string, string> = {};
      op.names.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1] ?? "");
      });
      return { op, params };
    }
    return null;
  };

  async function run(route: MockRoute, ctx: MockContext, forced: string): Promise<MockOutcome> {
    const variant = VARIANT_STATES.includes(forced) ? route.variants?.[forced as VariantState] : undefined;
    if (forced === "restricted" && variant === undefined) return errorOutcome(new ApiError("COMMON_FORBIDDEN", { forced_state: forced }));
    try {
      const resolved: unknown = await (variant ?? route.resolve)(ctx);
      const body = forced === "empty" && variant === undefined ? emptyPage(resolved) : resolved;
      const sample = typeof body === "object" && body !== null && (body as Record<string, unknown>)["data_source"] === "sample";
      const headers: Record<string, string> = sample ? { "x-data-source": "sample" } : {};
      if (body === undefined) return { kind: "empty", status: route.status ?? STATUS_NO_CONTENT, headers };
      return { kind: "json", status: route.status ?? STATUS_OK, body, headers };
    } catch (error) {
      if (isApiError(error)) return errorOutcome(error);
      return errorOutcome(new ApiError("COMMON_INTERNAL", { message: error instanceof Error ? error.message : String(error) }));
    }
  }

  async function handle(request: MockRequest): Promise<MockOutcome> {
    const url = new URL(request.url, "http://localhost");
    if (!url.pathname.startsWith(`${API_PREFIX}/`)) return { kind: "passthrough" };
    const forced = control.forcedState();
    if (forced === "loading") return { kind: "hang" };
    if (forced === "offline") return { kind: "network_error" };
    if (forced === "error") return errorOutcome(new ApiError("COMMON_INTERNAL", { forced_state: forced }));
    const method = request.method.toUpperCase();
    const found = find(method, url.pathname.slice(API_PREFIX.length));
    if (found === null) return { kind: "passthrough" };
    if (control.isReal(found.op.owner)) {
      return forced === "restricted" ? errorOutcome(new ApiError("COMMON_FORBIDDEN", { forced_state: forced })) : { kind: "passthrough" };
    }
    const route = byId.get(found.op.id);
    if (route === undefined || found.op.internal) {
      return errorOutcome(new ApiError("COMMON_NOT_FOUND", { operation_id: found.op.id, reason: "no_mock" }));
    }
    const now = control.now();
    const ctx: MockContext = {
      db,
      control,
      exam: db.examByKey(control.examKey()),
      now,
      day: db.learningDay(now),
      params: found.params,
      query: url.searchParams,
      body: request.body,
      headers: request.headers,
    };
    const key = request.headers.get("idempotency-key");
    if (key === null || key === "" || !WRITE_METHODS.has(method)) return run(route, ctx, forced);
    // 幂等：同一个键只执行一次，正在执行的也算；记录在内存仓库里，重置演示数据时一起清掉
    return db.once(`${found.op.id}:${key}`, () => run(route, ctx, forced));
  }

  return { handle };
}
