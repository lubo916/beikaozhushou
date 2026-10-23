import { getGetGrowthProfileQueryKey, isApiError, useGetGrowthProfile, type S34GrowthProfile } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < SERVER_ERROR_STATUS) return false;
  return failureCount < RETRY_LIMIT;
}

export interface GrowthQuery {
  readonly data: S34GrowthProfile | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}

export function growthView(query: GrowthQuery) {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) {
    return {
      state: query.data.goals.length === 0 && query.data.history.length === 0 ? ("empty" as const) : ("normal" as const),
      data: query.data,
      stale: offline,
    };
  }
  if (offline) return { state: "offline" as const, data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading" as const, data: undefined, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN")
    return { state: "restricted" as const, data: undefined, stale: false };
  return { state: "error" as const, data: undefined, stale: false };
}

export function useGrowthProfile() {
  const query = useGetGrowthProfile({ query: { queryKey: getGetGrowthProfileQueryKey(), retry: shouldRetry } });
  return { ...growthView(query), retry: () => void query.refetch() };
}
