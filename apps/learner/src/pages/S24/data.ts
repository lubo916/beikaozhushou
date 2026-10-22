// S24 的数据（ui-rules 第 8 节、api-rules 第 3 节）：页面只经生成的钩子拿数据；“该显示七态里的哪一态”也在这里判断，页面组件只管显示。
// ?state= 由接口层制造（加载挂起、出错回 500、离线断网，空、受限、数据不足给特定数据），页面不为测试写分支。
// 离线（R06：离线只显示上次的结果和计算时间）：只缓存接口真正返回过的结果，原样保留 computed_at。
// 缓存按“地址里的演示考试”分格，地址没写考试时单独一格，不冒充任何一个考试；读出来先过生成的 Zod，坏的丢掉、按没有缓存处理。
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { getGetS24ProgressQueryKey, isApiError, useGetS24Progress, type S24Progress } from "@exam-prep/contract";
import { getS24ProgressResponse } from "@exam-prep/contract/zod";

const RETRIES = 1;
const SERVER_ERROR = 500;

/** 网络或服务异常自动再试一次（F08-Q3）；4xx（受限、找不到）再试也没用，不重试。 */
export function shouldRetry(count: number, error: unknown): boolean {
  return count < RETRIES && (!isApiError(error) || error.status >= SERVER_ERROR);
}

/** 判断要用到的请求结果（TanStack Query 结果里的几项）；单独写出来，测试可以直接喂。 */
export interface ProgressQuery {
  readonly data?: S24Progress | undefined;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
  readonly error: unknown;
}

/** 没联网：请求没拿到回应（不是接口回的错误），或查询被暂停。 */
function isOffline(query: ProgressQuery): boolean {
  return query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
}

export function progressView(query: ProgressQuery, cached?: S24Progress) {
  const offline = isOffline(query);
  const data = query.data ?? (offline ? cached : undefined);
  if (data) return { data, state: data.has_progress ? ("normal" as const) : ("empty" as const), stale: offline };
  if (offline) return { data, state: "offline" as const, stale: false };
  if (query.status === "pending") return { data, state: "loading" as const, stale: false };
  return { data, state: "error" as const, stale: false };
}

/** 缓存键的前缀：接口形状变了就加版本号（旧缓存过不了 Zod 也会被丢掉）。 */
export const PROGRESS_CACHE_PREFIX = "S24:progress:v2:";
/** 地址里没写 ?exam= 时用的格子：只代表“当前目标”，不冒充任何一个演示考试。 */
export const CURRENT_SLOT = "current";

/** 缓存放在哪：默认是本标签页的 sessionStorage；测试可以换成内存里的。 */
export type CacheStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** 缓存格子：地址里的 ?exam=（开发与测试用），没写就是“当前目标”。 */
export function progressSlot(search: URLSearchParams): string {
  return search.get("exam") ?? CURRENT_SLOT;
}

function sessionStore(): CacheStore | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** 读缓存：只认这一格；过不了生成的 Zod（损坏、旧版本）就删掉，按没有缓存处理。 */
export function readCachedProgress(slot: string, store: CacheStore | undefined = sessionStore()): S24Progress | undefined {
  if (store === undefined) return undefined;
  const key = PROGRESS_CACHE_PREFIX + slot;
  try {
    const raw = store.getItem(key);
    if (raw === null) return undefined;
    const result = getS24ProgressResponse.safeParse(JSON.parse(raw) as unknown);
    if (result.success) return result.data as S24Progress;
  } catch {
    /* 解析失败按损坏处理。 */
  }
  try {
    store.removeItem(key);
  } catch {
    /* 浏览器禁用缓存时不处理。 */
  }
  return undefined;
}

/** 写缓存：只写接口真正返回的结果，原样保存（含计算时间 computed_at）。 */
export function writeCachedProgress(slot: string, data: S24Progress, store: CacheStore | undefined = sessionStore()): void {
  if (store === undefined) return;
  try {
    store.setItem(PROGRESS_CACHE_PREFIX + slot, JSON.stringify(data));
  } catch {
    /* 存满或被禁用：在线照常查看。 */
  }
}

export function useProgress() {
  const [search] = useSearchParams();
  const slot = progressSlot(search);
  const query = useGetS24Progress({ query: { queryKey: [...getGetS24ProgressQueryKey(), slot], retry: shouldRetry } });
  useEffect(() => {
    if (query.data) writeCachedProgress(slot, query.data);
  }, [slot, query.data]);
  // 只有没联网、手里又没有这次的结果时才去读缓存。
  const cached = query.data === undefined && isOffline(query) ? readCachedProgress(slot) : undefined;
  return { ...progressView(query, cached), retry: () => void query.refetch() };
}
