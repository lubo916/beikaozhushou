import { getGetPrivacyCenterQueryKey, isApiError, useGetPrivacyCenter, type S32PrivacyCenter } from "@exam-prep/contract";
export type PrivacyState = "loading" | "error" | "offline" | "restricted" | "empty" | "normal" | "insufficient_data";
export interface PrivacyQuery {
  readonly data: S32PrivacyCenter | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(count: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR_STATUS) && count < RETRY_LIMIT;
}
export function privacyView(query: PrivacyQuery) {
  // 权限被撤回时优先隐藏缓存，不能继续展示原隐私数据。
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN")
    return { state: "restricted" as const, data: undefined, stale: false };
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  const data = query.data;
  if (data !== undefined) return { state: data.display_state as PrivacyState, data, stale: offline };
  const state: PrivacyState = offline
    ? "offline"
    : query.status === "pending"
      ? "loading"
      : isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN"
        ? "restricted"
        : "error";
  return { state, data, stale: false };
}
export function usePrivacyCenter() {
  const query = useGetPrivacyCenter({ query: { queryKey: getGetPrivacyCenterQueryKey(), retry: shouldRetry } });
  return { ...privacyView(query), retry: () => void query.refetch() };
}
