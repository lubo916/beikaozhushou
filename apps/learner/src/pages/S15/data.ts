import { getGetReviewHomeQueryKey, isApiError, useGetReviewHome, type S15ReviewHome } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR_STATUS) && failureCount < RETRY_LIMIT;
}
export interface HomeQuery {
  readonly data: S15ReviewHome | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export type HomeState = "normal" | "loading" | "error" | "offline" | "empty" | "restricted" | "insufficient_data";
export function homeView(query: HomeQuery): { state: HomeState; data: S15ReviewHome | undefined; stale: boolean } {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.state, data: query.data, stale: offline };
  if (offline) return { state: "offline", data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data: undefined, stale: false };
  return { state: "error", data: undefined, stale: false };
}
export function useReviewHome() {
  const query = useGetReviewHome({ query: { queryKey: getGetReviewHomeQueryKey(), retry: shouldRetry } });
  return { ...homeView(query), retry: () => void query.refetch() };
}
