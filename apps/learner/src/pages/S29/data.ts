// S29 的数据（照 S10 样板，ui-rules 第 13 节）：页面只经生成的钩子拿数据；“该显示七态里的哪一态”在这里判断，页面只管显示。
// ?state= 由接口层制造（加载挂起、出错回 500、离线断网；空、受限、数据不足给本页的特定数据），页面不为测试写分支。
// 与样板页不同的两处（U29 回归测试锁定）：
// 1. 接口明确拒绝（403）或出错时，以这次的接口结果为准，不再显示之前缓存的个人内容；只有断网才保留缓存并标明离线。
// 2. 请求带上当前目标考试（exam_id），查询键随之按考试分开：同一页切换考试，不会沿用上一考试的结果。
import {
  getGetSearchPageQueryKey,
  isApiError,
  useGetMeContext,
  useGetSearchPage,
  type GetSearchPageParams,
  type S29SearchPage,
} from "@exam-prep/contract";

/** 网络或服务异常自动再试一次（F08-Q3）；4xx（受限、找不到）再试也没用，不重试。 */
const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < SERVER_ERROR_STATUS) return false;
  return failureCount < RETRY_LIMIT;
}

/** 判断要用到的请求结果（TanStack Query 结果里的几项）；单独写出来，测试可以直接喂。 */
export interface SearchQuery {
  readonly data: S29SearchPage | undefined;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
  readonly error: unknown;
}

/** restricted 有两种：接口拒绝（403，data 为空，整页说明账号受限）与拍照额度受限（data 在，只停拍照，文本搜索照常）。 */
export type SearchState = S29SearchPage["state_hint"] | "loading" | "offline" | "error";

export interface SearchView {
  readonly state: SearchState;
  readonly data: S29SearchPage | undefined;
  /** 有上次取到的数据，但这次因为没联网没取到：照常显示能离线用的部分，顶上加一条离线提示。 */
  readonly stale: boolean;
}

export function searchView(query: SearchQuery): SearchView {
  if (query.status === "error" && isApiError(query.error)) {
    return { state: query.error.code === "COMMON_FORBIDDEN" ? "restricted" : "error", data: undefined, stale: false };
  }
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.state_hint, data: query.data, stale: offline };
  if (offline) return { state: "offline", data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false };
  return { state: "error", data: undefined, stale: false };
}

/** 本页的数据钩子：生成的钩子，加上当前目标考试、重试策略与七态判断。 */
export function useSearchPage(params: Omit<GetSearchPageParams, "exam_id">): SearchView & { readonly retry: () => void } {
  const examId = useGetMeContext().data?.goal?.exam_id;
  const request: GetSearchPageParams = examId === undefined ? params : { ...params, exam_id: examId };
  const query = useGetSearchPage(request, { query: { queryKey: getGetSearchPageQueryKey(request), retry: shouldRetry } });
  return { ...searchView(query), retry: () => void query.refetch() };
}
