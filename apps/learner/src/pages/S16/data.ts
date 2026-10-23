import { getGetRecitationTrainingQueryKey, isApiError, useGetRecitationTraining, type S16Training } from "@exam-prep/contract";

// 网络/服务错误只重试一次，4xx 不重试（F08-Q3，沿用样板的请求策略）。
const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < SERVER_ERROR_STATUS) return false;
  return failureCount < RETRY_LIMIT;
}

export type RecitationState = "normal" | "loading" | "empty" | "error" | "offline" | "restricted" | "insufficient_data";
export interface RecitationQuery {
  readonly data: S16Training | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export interface RecitationView {
  readonly data: S16Training | undefined;
  readonly state: RecitationState;
  readonly stale: boolean;
}
export function recitationView(query: RecitationQuery): RecitationView {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  const data = query.data;
  if (data !== undefined) {
    let state: RecitationState = "normal";
    if (data.items.length === 0) state = "empty";
    else if (!data.oral_available) state = "restricted";
    else if (data.last_result.order === undefined) state = "insufficient_data";
    return { data, state, stale: offline };
  }
  if (offline) return { data, state: "offline", stale: false };
  if (query.status === "pending") return { data, state: "loading", stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { data, state: "restricted", stale: false };
  return { data, state: "error", stale: false };
}

export function useRecitationTraining(): RecitationView & { readonly retry: () => void } {
  const query = useGetRecitationTraining({ query: { queryKey: getGetRecitationTrainingQueryKey(), retry: shouldRetry } });
  return { ...recitationView(query), retry: () => void query.refetch() };
}
