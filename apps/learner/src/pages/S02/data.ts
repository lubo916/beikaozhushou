import { getGetS02GoalsQueryKey, isApiError, useGetS02Goals, type S02GoalsHome } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR = 500;
export function shouldRetry(count: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR) && count < RETRY_LIMIT;
}
export interface GoalsQuery {
  readonly data: S02GoalsHome | undefined;
  readonly error: unknown;
  readonly status: "pending" | "success" | "error";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export type GoalsState = "normal" | "loading" | "empty" | "error" | "offline" | "restricted" | "insufficient_data";
export function goalsView(query: GoalsQuery): { state: GoalsState; data: S02GoalsHome | undefined; stale: boolean } {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.availability, data: query.data, stale: offline };
  if (offline) return { state: "offline", data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data: undefined, stale: false };
  return { state: "error", data: undefined, stale: false };
}
/** 公共生成链尚未将 query 参数写入请求地址，本页暂经生成钩子的请求选项传递。
 * 头值 URI 编码以支持中文；契约记录兼容字段，待整合修复公共链后移除。 */
export function searchRequestOptions(q: string, category: string) {
  return { headers: { "x-s02-search": encodeURIComponent(q), "x-s02-category": encodeURIComponent(category) } };
}
/** 接口层处理筛选与七态；页面不计算任何业务数字。保留上次成功响应供断网时查看。 */
export function useGoals(q: string, category: string) {
  const query = useGetS02Goals(
    { q, category },
    {
      request: searchRequestOptions(q, category),
      query: { queryKey: getGetS02GoalsQueryKey({ q, category }), retry: shouldRetry, placeholderData: (previous) => previous },
    },
  );
  return { ...goalsView(query), retry: () => void query.refetch() };
}
