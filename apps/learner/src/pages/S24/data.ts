// S24 只经生成钩子读业务数字；七态由接口结果映射，不按地址里的测试状态改页面。
// 离线只显示身份已确认的目标的旧结果与原计算时间（R06 R2、R12）；地址里的演示别名不代表当前目标。
import { useEffect, useState } from "react";
import {
  getGetS24ProgressQueryKey,
  getGetMeContextQueryKey,
  isApiError,
  useGetMeContext,
  useGetS24Progress,
  type S24Progress,
} from "@exam-prep/contract";

const RETRIES = 1;
const SERVER_ERROR = 500;

/** 网络或服务异常自动再试一次（F08-Q3）；4xx 不重试。 */
export function shouldRetry(count: number, error: unknown): boolean {
  return count < RETRIES && (!isApiError(error) || error.status >= SERVER_ERROR);
}

/** 判断要用到的请求结果；纯函数测试可直接喂。 */
export interface ProgressQuery {
  readonly data?: S24Progress | undefined;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
  readonly error: unknown;
}

/** 公开 /me/context 钩子里判断当前目标所需的字段。旧结果仍在 data 中不等于身份已确认。 */
export interface GoalQuery {
  readonly data?: { readonly goal?: { readonly exam_id: string } | undefined } | undefined;
  readonly status: ProgressQuery["status"];
  readonly fetchStatus: ProgressQuery["fetchStatus"];
  readonly isStale: boolean;
  readonly error: unknown;
}

/** 刷新中、失败、失效或还没取到的目标身份都不能拿来认领缓存。 */
export function confirmedExamId(query: GoalQuery): string | undefined {
  if (query.status !== "success" || query.fetchStatus !== "idle" || query.isStale) return undefined;
  const id = query.data?.goal?.exam_id;
  return id !== undefined && id.trim() !== "" ? id : undefined;
}

/** 只有这次挂载后新成功、未失效的本页响应，才能在上下文不可用时确认当前目标。 */
export interface FreshProgressQuery extends ProgressQuery {
  readonly isStale: boolean;
  readonly isFetchedAfterMount: boolean;
}

export function confirmedProgressExamId(query: FreshProgressQuery): string | undefined {
  if (query.status !== "success" || query.fetchStatus !== "idle" || query.isStale || !query.isFetchedAfterMount) return undefined;
  const id = query.data?.exam_id;
  return id !== undefined && id.trim() !== "" ? id : undefined;
}

/** 没联网：请求没拿到回应，或查询被暂停。 */
function isOffline(query: ProgressQuery): boolean {
  return query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
}

/** 七态映射；调用方须先用 progressForTarget 过滤不属于已确认目标的数据。 */
export function progressView(query: ProgressQuery, cached?: S24Progress) {
  const offline = isOffline(query);
  const data = query.data ?? (offline ? cached : undefined);
  if (data) return { data, state: data.has_progress ? ("normal" as const) : ("empty" as const), stale: offline };
  if (offline) return { data, state: "offline" as const, stale: false };
  if (query.status === "pending") return { data, state: "loading" as const, stale: false };
  return { data, state: "error" as const, stale: false };
}

/** 网络结果和离线缓存必须同时核对身份；未知身份不能借用上一次目标的数字。 */
export function progressForTarget(query: ProgressQuery, expectedExamId: string | undefined, cached?: S24Progress) {
  const data = expectedExamId !== undefined && query.data?.exam_id === expectedExamId ? query.data : undefined;
  const matchedCache = expectedExamId !== undefined && cached?.exam_id === expectedExamId ? cached : undefined;
  return progressView({ ...query, data }, matchedCache);
}

/** v3 改为真实 exam_id 分格，旧的地址别名与 current 缓存不再读取。 */
export const PROGRESS_CACHE_PREFIX = "S24:progress:v3:";
/** 兼容旧调用的未确认标记；这一标记从不作为实际缓存身份。 */
export const CURRENT_SLOT = "current";
export type CacheStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** 保留旧 helper 的地址提示用途；不可把这个结果当作目标身份或实际缓存键。 */
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

/** 缓存只认已确认的真实考试 ID，且 payload 身份必须相符。第三参兼容旧的地址槽调用方式。 */
export async function readCachedProgress(
  slot: string,
  store: CacheStore | undefined = sessionStore(),
  expectedExamId = slot,
): Promise<S24Progress | undefined> {
  if (store === undefined || expectedExamId === CURRENT_SLOT || expectedExamId.trim() === "") return undefined;
  const key = PROGRESS_CACHE_PREFIX + expectedExamId;
  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch {
    return undefined;
  }
  if (raw === null) return undefined;
  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    discardCachedProgress(store, key, raw);
    return undefined;
  }
  // 全量生成校验器只在确有离线缓存待核对时加载，不阻塞在线查询或500出错态。
  let validate: typeof import("@exam-prep/contract/zod").getS24ProgressResponse;
  try {
    ({ getS24ProgressResponse: validate } = await import("@exam-prep/contract/zod"));
  } catch {
    // 模块暂时不可达不等于缓存损坏；保留原raw，不显示未经校验的业务数字。
    return undefined;
  }
  try {
    const result = validate.safeParse(payload);
    if (result.success && result.data.exam_id === expectedExamId) return result.data as S24Progress;
  } catch {
    /* 损坏或旧形状仍按无可用缓存处理。 */
  }
  discardCachedProgress(store, key, raw);
  return undefined;
}

function discardCachedProgress(store: CacheStore, key: string, original: string): void {
  try {
    if (store.getItem(key) === original) store.removeItem(key);
  } catch {
    /* 浏览器禁用缓存时不处理。 */
  }
}

/** 保留 slot 参数以兼容旧调用；实际键只使用响应 exam_id，原样保存 computed_at。 */
export function writeCachedProgress(_slot: string, data: S24Progress, store: CacheStore | undefined = sessionStore()): void {
  if (store === undefined) return;
  try {
    store.setItem(PROGRESS_CACHE_PREFIX + data.exam_id, JSON.stringify(data));
  } catch {
    /* 存满或被禁用：在线照常查看。 */
  }
}

export function useProgress() {
  const [cachedProgress, setCachedProgress] = useState<{ readonly examId: string; readonly data: S24Progress }>();
  // 不读开发工具条或 mocks；成功身份保留到失效，进入本页重新确认。
  const context = useGetMeContext({
    query: { queryKey: getGetMeContextQueryKey(), retry: shouldRetry, staleTime: Number.POSITIVE_INFINITY, refetchOnMount: "always" },
  });
  const contextExamId = confirmedExamId(context);
  const query = useGetS24Progress({
    // 目标确认会更换queryKey；查询仍丢弃旧结果，只读GET继续完成，避免把取消竞态传给Service Worker。
    request: { signal: null },
    query: {
      queryKey: [...getGetS24ProgressQueryKey(), contextExamId ?? CURRENT_SLOT],
      retry: shouldRetry,
      staleTime: Number.POSITIVE_INFINITY,
      refetchOnMount: "always",
    },
  });
  // 空态或受限时 /me/context 可能没有目标/返回受限；本页本次新成功响应仍可证明它展示的是哪个当前目标。
  // query 失败、刷新中、已失效或仅留有挂载前的旧 data 时都不能作为身份证明。
  const expectedExamId = contextExamId ?? confirmedProgressExamId(query);
  useEffect(() => {
    if (
      expectedExamId !== undefined &&
      query.status === "success" &&
      query.fetchStatus === "idle" &&
      query.data?.exam_id === expectedExamId
    ) {
      writeCachedProgress(expectedExamId, query.data);
      // 在线成功后后台预热，保持后续真实断网时可校验缓存；不等待它才显示页面。
      void import("@exam-prep/contract/zod").catch(() => undefined);
    }
  }, [expectedExamId, query.status, query.fetchStatus, query.data]);
  // 尚未确认身份的旧 success 等待本次请求；网络/服务出错仍保留本页请求本身的七态。
  const source: ProgressQuery =
    expectedExamId === undefined && query.status === "success" ? { ...query, data: undefined, status: "pending" } : query;
  const offline = isOffline(source);
  useEffect(() => {
    // 每次effect独立失效，A→B→A和断网→联网时也不能接回旧的异步结果。
    let active = true;
    const pending = offline && expectedExamId !== undefined ? readCachedProgress(expectedExamId) : Promise.resolve(undefined);
    void pending.then((data) => {
      if (active) setCachedProgress(data && expectedExamId !== undefined ? { examId: expectedExamId, data } : undefined);
    });
    return () => {
      active = false;
    };
  }, [offline, expectedExamId]);
  const cached = offline && expectedExamId !== undefined && cachedProgress?.examId === expectedExamId ? cachedProgress.data : undefined;
  return {
    ...progressForTarget(source, expectedExamId, cached),
    retry: () => {
      void context.refetch();
      void query.refetch();
    },
  };
}
