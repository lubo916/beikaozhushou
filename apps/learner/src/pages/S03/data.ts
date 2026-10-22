import { getGetSetupProfileQueryKey, isApiError, useGetSetupProfile, type S03SetupProfile } from "@exam-prep/contract";

export interface SetupQuery {
  readonly data: S03SetupProfile | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR_STATUS) && failureCount < RETRY_LIMIT;
}
export function setupView(query: SetupQuery) {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.state, data: query.data, stale: offline } as const;
  if (offline) return { state: "offline", data: undefined, stale: false } as const;
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false } as const;
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN")
    return { state: "restricted", data: undefined, stale: false } as const;
  return { state: "error", data: undefined, stale: false } as const;
}
export function useSetupProfile() {
  const query = useGetSetupProfile({ query: { queryKey: getGetSetupProfileQueryKey(), retry: shouldRetry } });
  return { ...setupView(query), retry: () => void query.refetch() };
}
