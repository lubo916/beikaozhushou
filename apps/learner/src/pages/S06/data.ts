// S06 今日的数据（ui-rules 第 8、13 节，api-rules 第 3 节）：页面只经生成的钩子拿数据；“该显示七态里的哪一态”也在这里按请求结果判断，
// 页面组件只管显示。?state= 由接口层制造（加载挂起、出错回 500、离线断网，空、受限、数据不足给特定数据），页面不为测试写分支。
// ?view= 只在开发与测试时生效：页面把它当查询参数 view 传给接口；正式环境由接口按数据定视图（ui-rules 第 5 节）。
import {
  getGetTodayHomeQueryKey,
  isApiError,
  useGetTodayHome,
  type GetTodayHomeParams,
  type S06Go,
  type S06Task,
  type S06TodayHome,
  type S06View,
} from "@exam-prep/contract";
import { ROUTES, pathTo } from "../../routes.ts";

/** 网络或服务异常自动再试一次（约一秒后出结果，F08-Q3）；4xx（受限、找不到）再试也没用，不重试。 */
const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < SERVER_ERROR_STATUS) return false;
  return failureCount < RETRY_LIMIT;
}

/** 本页的六个视图（pages.md）：正常、首次进入、全部完成、今天不可学、中断回归、导师不可用。 */
export const TODAY_VIEWS: readonly S06View[] = ["normal", "first", "done", "off", "back", "noai"];

/** 地址里的 ?view= 转成视图；不认识的不传，由接口按数据定。 */
export function forcedView(value: string | null): S06View | undefined {
  return TODAY_VIEWS.find((view) => view === value);
}

/** 整页的状态。本页的“受限”（额度用完）与“数据不足”（按典型节奏排）另有一层只落在页面里的一块，清单照常（F08-Q1）。 */
export type TodayState = "loading" | "error" | "offline" | "restricted" | "empty" | "normal";

/** 判断要用到的请求结果（TanStack Query 结果里的几项）；单独写出来，测试可以直接喂。 */
export interface TodayQuery {
  readonly data: S06TodayHome | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}

export interface TodayView {
  readonly state: TodayState;
  readonly data: S06TodayHome | undefined;
  /** 有上次取到的数据，但这次因为没联网没取到：照常显示，顶上加一条离线提示。 */
  readonly stale: boolean;
}

/** 没联网：请求没拿到回应（不是接口回的错误），或浏览器报告离线、查询被暂停。 */
function isOffline(query: TodayQuery): boolean {
  return query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
}

/** 空态：三段都没有任务（bk spec：今天没有安排｜目标日已过或还没生成计划）。只看列表空不空，不算业务数字。 */
export function isEmptyToday(data: S06TodayHome): boolean {
  return data.segments.every((segment) => segment.items.length === 0);
}

export function todayView(query: TodayQuery): TodayView {
  const { data } = query;
  if (data !== undefined) return { state: isEmptyToday(data) ? "empty" : "normal", data, stale: isOffline(query) };
  if (isOffline(query)) return { state: "offline", data, stale: false };
  if (query.status === "pending") return { state: "loading", data, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data, stale: false };
  return { state: "error", data, stale: false };
}

/** 下一项（英雄区“继续”或“开始”的那一项）：按接口给的 next_task_id 在清单里找，页面不自己挑。 */
export function nextTask(data: S06TodayHome): S06Task | undefined {
  const id = data.next_task_id;
  if (id === undefined) return undefined;
  return data.segments.flatMap((segment) => segment.items).find((item) => item.task.id === id);
}

/** 一键开始直达的位置（feat:S06-06）：路由表里的路径，带参数的页面填上接口给的参数（没给就用 demo）。 */
export function goPath(go: S06Go): string {
  const name = /:(\w+)/.exec(ROUTES[go.page])?.[1];
  return pathTo(go.page, name === undefined || go.param === undefined ? {} : { [name]: go.param });
}

/** 本页的数据钩子：生成的钩子，加上重试策略与七态判断。view 只在开发与测试时传（地址里的 ?view=）。 */
export function useTodayHome(view: S06View | undefined): TodayView & { readonly retry: () => void } {
  const params: GetTodayHomeParams = view === undefined ? {} : { view };
  const query = useGetTodayHome(params, { query: { queryKey: getGetTodayHomeQueryKey(params), retry: shouldRetry } });
  return { ...todayView(query), retry: () => void query.refetch() };
}
