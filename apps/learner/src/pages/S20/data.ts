import { getGetGradingWorkspaceQueryKey, isApiError, useGetGradingWorkspace, type S20Workspace } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR_STATUS) && failureCount < RETRY_LIMIT;
}
export interface GradingQuery {
  readonly data: S20Workspace | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export function gradingView(query: GradingQuery) {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  const state =
    query.data !== undefined
      ? query.data.submission === null
        ? "empty"
        : "normal"
      : offline
        ? "offline"
        : query.status === "pending"
          ? "loading"
          : "error";
  return { state, data: query.data, stale: query.data !== undefined && offline } as const;
}
export function useGradingWorkspace() {
  const query = useGetGradingWorkspace({ query: { queryKey: getGetGradingWorkspaceQueryKey(), retry: shouldRetry } });
  return { ...gradingView(query), retry: () => void query.refetch() };
}
