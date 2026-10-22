import { isApiError } from "@exam-prep/contract/errors";
import type { O01Workbench } from "@exam-prep/contract";
export type WorkbenchState = "normal" | "loading" | "empty" | "error" | "offline" | "restricted";
export interface WorkbenchQuery {
  readonly data: O01Workbench | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(count: number, error: unknown): boolean {
  return (!isApiError(error) || error.status >= SERVER_ERROR_STATUS) && count < RETRY_LIMIT;
}
export function workbenchView(query: WorkbenchQuery) {
  // 权限拒绝优先于缓存，防止已撤销授权的数据继续留在页面。
  if (query.status === "error" && isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN")
    return { state: "restricted" as const, data: undefined, stale: false };
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined)
    return {
      state:
        query.data.access !== "restricted" &&
        query.data.sample_sufficient &&
        query.data.classes.length === 0 &&
        query.data.todos.length === 0
          ? ("empty" as const)
          : ("normal" as const),
      data: query.data,
      stale: offline,
    };
  const state: WorkbenchState = offline
    ? "offline"
    : query.status === "pending"
      ? "loading"
      : isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN"
        ? "restricted"
        : "error";
  return { state, data: undefined, stale: false };
}
