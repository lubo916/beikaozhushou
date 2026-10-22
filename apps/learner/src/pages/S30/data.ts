// 只经生成钩子读取；七态按请求结果映射，?state= 由 MSW 统一处理。
import { getGetS30StudyRoomQueryKey, isApiError, useGetS30StudyRoom, type S30StudyRoom } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < SERVER_ERROR_STATUS) return false;
  return failureCount < RETRY_LIMIT;
}
export interface RoomQuery {
  readonly data: S30StudyRoom | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export type RoomState = S30StudyRoom["page_state"] | "loading" | "offline" | "error";
export function roomView(query: RoomQuery): { state: RoomState; data: S30StudyRoom | undefined; stale: boolean } {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.page_state, data: query.data, stale: offline };
  if (offline) return { state: "offline", data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data: undefined, stale: false };
  return { state: "error", data: undefined, stale: false };
}
export function useStudyRoom() {
  const query = useGetS30StudyRoom({ query: { queryKey: getGetS30StudyRoomQueryKey(), retry: shouldRetry } });
  return { ...roomView(query), retry: () => void query.refetch() };
}
