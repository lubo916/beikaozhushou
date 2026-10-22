import { getGetClassroomHomeQueryKey, isApiError, useGetClassroomHome, type S13ClassroomHome } from "@exam-prep/contract";
const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(count: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR_STATUS) && count < RETRY_LIMIT;
}
export interface ClassroomQuery {
  readonly data: S13ClassroomHome | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export type ClassroomState = "normal" | "loading" | "empty" | "error" | "offline" | "restricted";
export function classroomView(query: ClassroomQuery): { state: ClassroomState; data: S13ClassroomHome | undefined; stale: boolean } {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.courses.length === 0 ? "empty" : "normal", data: query.data, stale: offline };
  if (offline) return { state: "offline", data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false };
  return {
    state: isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN" ? "restricted" : "error",
    data: undefined,
    stale: false,
  };
}
export function useClassroom() {
  const query = useGetClassroomHome({ query: { queryKey: getGetClassroomHomeQueryKey(), retry: shouldRetry } });
  return { ...classroomView(query), retry: () => void query.refetch() };
}
