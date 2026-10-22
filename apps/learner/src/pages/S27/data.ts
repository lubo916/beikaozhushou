import { getGetS27SprintHomeQueryKey, isApiError, useGetS27SprintHome, type S27SprintHome } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(failures: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR_STATUS) && failures < RETRY_LIMIT;
}
export interface SprintQuery {
  readonly data: S27SprintHome | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export function sprintView(query: SprintQuery) {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  const { data } = query;
  if (data !== undefined)
    return { data, state: data.availability === "not_yet" ? ("empty" as const) : ("normal" as const), stale: offline };
  if (offline) return { data, state: "offline" as const, stale: false };
  if (query.status === "pending") return { data, state: "loading" as const, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { data, state: "restricted" as const, stale: false };
  return { data, state: "error" as const, stale: false };
}
export function useSprintHome() {
  const query = useGetS27SprintHome({ query: { queryKey: getGetS27SprintHomeQueryKey(), retry: shouldRetry } });
  return { ...sprintView(query), retry: () => void query.refetch() };
}
