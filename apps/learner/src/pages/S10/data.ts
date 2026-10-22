// S10 的数据（ui-rules 第 8 节、api-rules 第 3 节）：页面只经生成的钩子拿数据；“该显示七态里的哪一态”也在这里按请求结果判断，
// 页面组件只管显示。?state= 由接口层制造（加载挂起、出错回 500、离线断网，空、受限、数据不足给特定数据），页面不为测试写分支。
import { getGetKnowledgePointHomeQueryKey, isApiError, useGetKnowledgePointHome, type S10KnowledgePointHome } from "@exam-prep/contract";

/** 网络或服务异常自动再试一次（约一秒后出结果，F08-Q3）；4xx（受限、找不到）再试也没用，不重试。 */
const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < SERVER_ERROR_STATUS) return false;
  return failureCount < RETRY_LIMIT;
}

/** 整页的状态。本页的“受限”“数据不足”另有一层只落在考点档案卡片里（看接口给的数据成熟度），整页照常。本页没有锁定态。 */
export type HomeState = "loading" | "error" | "offline" | "restricted" | "empty" | "normal";

/** 判断要用到的请求结果（TanStack Query 结果里的几项）；单独写出来，测试可以直接喂。 */
export interface HomeQuery {
  readonly data: S10KnowledgePointHome | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}

export interface HomeView {
  readonly state: HomeState;
  readonly data: S10KnowledgePointHome | undefined;
  /** 有上次取到的数据，但这次因为没联网没取到：照常显示，顶上加一条离线提示。 */
  readonly stale: boolean;
}

/** 没联网：请求没拿到回应（不是接口回的错误），或浏览器报告离线、查询被暂停。 */
function isOffline(query: HomeQuery): boolean {
  return query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
}

/** 空态：既没挂资料也没有题目（bk spec：这个知识点还没有内容｜还没挂上资料与题目）。只看列表空不空，不算业务数字。 */
export function isEmptyHome(data: S10KnowledgePointHome): boolean {
  return data.materials.length === 0 && data.questions.length === 0;
}

export function homeView(query: HomeQuery): HomeView {
  const { data } = query;
  if (data !== undefined) return { state: isEmptyHome(data) ? "empty" : "normal", data, stale: isOffline(query) };
  if (isOffline(query)) return { state: "offline", data, stale: false };
  if (query.status === "pending") return { state: "loading", data, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data, stale: false };
  return { state: "error", data, stale: false };
}

/** 本页的数据钩子：生成的钩子，加上重试策略与七态判断。 */
export function useKnowledgePointHome(pointId: string): HomeView & { readonly retry: () => void } {
  const query = useGetKnowledgePointHome(pointId, { query: { queryKey: getGetKnowledgePointHomeQueryKey(pointId), retry: shouldRetry } });
  return { ...homeView(query), retry: () => void query.refetch() };
}
