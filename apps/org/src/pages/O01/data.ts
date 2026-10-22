import { isApiError, useGetO01Workbench, type O01Workbench, type GetO01WorkbenchParams } from "@exam-prep/contract";
export type WorkbenchState = "normal" | "loading" | "empty" | "error" | "offline" | "restricted";
interface Query {
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
export function workbenchView(query: Query) {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined)
    return {
      state: query.data.classes.length === 0 && query.data.todos.length === 0 ? ("empty" as const) : ("normal" as const),
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
export function useWorkbench(params: GetO01WorkbenchParams) {
  const query = useGetO01Workbench(params, { query: { retry: shouldRetry } });
  return { ...workbenchView(query), retry: () => void query.refetch() };
}
