// S30 的数据（照 S10 样板，ui-rules 第 13 节）：只经生成的钩子读取；七态按请求结果映射，?state= 由接口层统一制造。
// 与样板页不同的两处（U29 回归测试锁定）：
// 1. 接口明确拒绝（403）或出错时，以这次的接口结果为准，不再显示之前缓存的房间与专注记录；只有断网才保留缓存并标明离线。
// 2. 请求带上当前目标考试（exam_id），查询键随之按考试分开：同一页切换考试，不会沿用上一考试的房间。
import {
  getGetS30StudyRoomQueryKey,
  isApiError,
  useGetMeContext,
  useGetS30StudyRoom,
  type GetS30StudyRoomParams,
  type S30StudyRoom,
} from "@exam-prep/contract";

/** 网络或服务异常自动再试一次（F08-Q3）；4xx 再试也没用，不重试。 */
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

/** restricted 有两种：接口拒绝（403，data 为空，整页说明账号受限）与未成年人模式（data 在，只留自习室与番茄钟）。 */
export type RoomState = S30StudyRoom["page_state"] | "loading" | "offline" | "error";

export interface RoomView {
  readonly state: RoomState;
  readonly data: S30StudyRoom | undefined;
  /** 有上次取到的数据，但这次因为没联网没取到：只显示能离线用的部分（番茄钟），顶上加一条离线提示。 */
  readonly stale: boolean;
}

export function roomView(query: RoomQuery): RoomView {
  if (query.status === "error" && isApiError(query.error)) {
    return { state: query.error.code === "COMMON_FORBIDDEN" ? "restricted" : "error", data: undefined, stale: false };
  }
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.page_state, data: query.data, stale: offline };
  if (offline) return { state: "offline", data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false };
  return { state: "error", data: undefined, stale: false };
}

/** 本页的数据钩子：生成的钩子，加上当前目标考试、重试策略与七态判断。 */
export function useStudyRoom(): RoomView & { readonly retry: () => void } {
  const examId = useGetMeContext().data?.goal?.exam_id;
  const request: GetS30StudyRoomParams = examId === undefined ? {} : { exam_id: examId };
  const query = useGetS30StudyRoom(request, { query: { queryKey: getGetS30StudyRoomQueryKey(request), retry: shouldRetry } });
  return { ...roomView(query), retry: () => void query.refetch() };
}
