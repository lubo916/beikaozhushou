import { useEffect } from "react";
import { useLocation } from "react-router";
import { getGetStartReportQueryKey, isApiError, useGetMeContext, useGetStartReport, type S05StartReport } from "@exam-prep/contract";
import { restoreReport, storeReport } from "./cache.ts";
const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(count: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR_STATUS) && count < RETRY_LIMIT;
}
export interface ReportQuery {
  readonly data: S05StartReport | undefined;
  readonly error: unknown;
  readonly status: "pending" | "success" | "error";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export function reportView(query: ReportQuery) {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.available ? "normal" : "empty", data: query.data, stale: offline } as const;
  if (offline) return { state: "offline", data: undefined, stale: false } as const;
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false } as const;
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN")
    return { state: "restricted", data: undefined, stale: false } as const;
  return { state: "error", data: undefined, stale: false } as const;
}
export function useStartReport(view: "normal" | "quick") {
  const location = useLocation();
  const selector = new URLSearchParams(location.search).get("exam");
  const me = useGetMeContext({ query: { queryKey: getGetMeContextQueryKey(), retry: shouldRetry } });
  const identity = me.data;
  const query = useGetStartReport(view, {
    query: {
      queryKey: [...getGetStartReportQueryKey(view), identity?.user.id, identity?.goal, selector],
      retry: shouldRetry,
    },
  });
  useEffect(() => {
    if (query.status === "success" && query.data !== undefined) storeReport(query.data);
  }, [query.data, query.status]);
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  const savedIdentityAllowed = me.fetchStatus === "paused" || (me.status === "error" && !isApiError(me.error));
  const cached = offline ? restoreReport(view, identity, selector, savedIdentityAllowed) : undefined;
  return { ...reportView({ ...query, data: query.data ?? cached }), retry: () => void query.refetch() };
}
