import { getGetSearchPageQueryKey, isApiError, useGetSearchPage, type GetSearchPageParams, type S29SearchPage } from "@exam-prep/contract";
const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR_STATUS) && failureCount < RETRY_LIMIT;
}
export interface SearchQuery {
  data: S29SearchPage | undefined;
  status: "pending" | "error" | "success";
  fetchStatus: "fetching" | "paused" | "idle";
  error: unknown;
}
export function searchView(query: SearchQuery) {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.state_hint, data: query.data, stale: offline } as const;
  const state = offline
    ? "offline"
    : query.status === "pending"
      ? "loading"
      : isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN"
        ? "restricted"
        : "error";
  return { state, data: undefined, stale: false } as const;
}
export function useSearchPage(params: GetSearchPageParams) {
  const query = useGetSearchPage(params, { query: { queryKey: getGetSearchPageQueryKey(params), retry: shouldRetry } });
  return { ...searchView(query), retry: () => void query.refetch() };
}
