import { getGetS11MaterialsWorkspaceQueryKey, isApiError, useGetS11MaterialsWorkspace, type S11Workspace } from "@exam-prep/contract";

export interface WorkspaceQuery {
  readonly data: S11Workspace | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export type WorkspaceState = "normal" | "loading" | "empty" | "error" | "offline" | "restricted" | "insufficient_data";
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && (!isApiError(error) || error.status >= 500);
}
export function workspaceView(query: WorkspaceQuery): { state: WorkspaceState; data: S11Workspace | undefined; stale: boolean } {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.availability, data: query.data, stale: offline };
  if (offline) return { state: "offline", data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false };
  return {
    state: isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN" ? "restricted" : "error",
    data: undefined,
    stale: false,
  };
}
export function useMaterialsWorkspace() {
  const query = useGetS11MaterialsWorkspace({ query: { queryKey: getGetS11MaterialsWorkspaceQueryKey(), retry: shouldRetry } });
  return { ...workspaceView(query), retry: () => void query.refetch() };
}
