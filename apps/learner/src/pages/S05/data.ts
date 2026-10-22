import { useEffect } from "react";
import { useLocation } from "react-router";
import {
  getGetMeContextQueryKey,
  getGetStartReportQueryKey,
  isApiError,
  useGetMeContext,
  useGetStartReport,
  type S05StartReport,
} from "@exam-prep/contract";
import { clearReportCache, restoreReport, storeReport } from "./cache.ts";
const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
function accessDenied(error: unknown): boolean {
  if (!isApiError(error)) return false;
  // 401 尚无登记错误码，统一 fetcher 以 COMMON_INTERNAL + details.status 保留原始状态。
  const originalStatus = error.details["status"];
  return error.status === 401 || error.status === 403 || originalStatus === 401 || originalStatus === 403;
}
export function shouldRetry(count: number, error: unknown): boolean {
  return !accessDenied(error) && !(isApiError(error) && error.status < SERVER_ERROR_STATUS) && count < RETRY_LIMIT;
}
export interface ReportQuery {
  readonly data: S05StartReport | undefined;
  readonly error: unknown;
  readonly status: "pending" | "success" | "error";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export function reportView(query: ReportQuery) {
  // 后台重新请求失败时查询仍可能保留旧 data，明确的权限拒绝必须优先。
  if (accessDenied(query.error)) return { state: "restricted", data: undefined, stale: false } as const;
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.available ? "normal" : "empty", data: query.data, stale: offline } as const;
  if (offline) return { state: "offline", data: undefined, stale: false } as const;
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false } as const;
  return { state: "error", data: undefined, stale: false } as const;
}
export function useStartReport(view: "normal" | "quick") {
  const location = useLocation();
  const selector = new URLSearchParams(location.search).get("exam");
  const me = useGetMeContext({ query: { queryKey: getGetMeContextQueryKey(), retry: shouldRetry } });
  const identity = me.data;
  const query = useGetStartReport(view, {
    query: {
      // 身份错误之后重新获取独立授权的报告，避免沿用身份拒绝前的内存数据；同样隔离后续网络错误。
      queryKey: [...getGetStartReportQueryKey(view), identity?.user.id, identity?.goal, selector, me.errorUpdatedAt],
      retry: shouldRetry,
    },
  });
  const identityDenied = accessDenied(me.error);
  const denied = identityDenied || accessDenied(query.error);
  useEffect(() => {
    if (denied) clearReportCache();
    else if (query.status === "success" && query.data !== undefined) storeReport(query.data);
  }, [denied, query.data, query.status]);
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  // 报告与身份两个请求各自重试，谁先失败说不准：身份还没回来或也没联网时，用本标签页最近一次成功报告的身份找缓存；
  // 服务器明确拒绝身份（如登录失效）时不读旧报告。
  const savedIdentityAllowed = identity === undefined && !(me.status === "error" && isApiError(me.error));
  const cached = offline && !denied ? restoreReport(view, identity, selector, savedIdentityAllowed) : undefined;
  // 身份接口拒绝后不读旧缓存；报告接口独立成功返回的新报告仍可供游客查看。
  const result =
    identityDenied && query.status !== "success"
      ? ({ state: "restricted", data: undefined, stale: false } as const)
      : reportView({ ...query, data: query.data ?? cached });
  return { ...result, retry: () => void query.refetch() };
}
