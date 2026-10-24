import { activeExamKey } from "./components/cache.ts";
import { useEffect } from "react";
import { getGetAssessmentReportQueryKey, isApiError, useGetAssessmentReport, type S23AssessmentReport } from "@exam-prep/contract";
import * as validators from "@exam-prep/contract/zod";

const RETRY_LIMIT = 1;
const SERVER_ERROR = 500;
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR) && failureCount < RETRY_LIMIT;
}
export interface ReportQuery {
  readonly data: S23AssessmentReport | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export type ReportState = "normal" | "loading" | "empty" | "error" | "offline" | "restricted";
export function reportView(
  query: ReportQuery,
  cached?: S23AssessmentReport,
): { state: ReportState; data: S23AssessmentReport | undefined } {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  const data = query.data ?? (offline ? cached : undefined);
  if (offline) return { state: "offline", data };
  if (data !== undefined) return { state: data.available ? "normal" : "empty", data };
  if (query.status === "pending") return { state: "loading", data };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data };
  return { state: "error", data };
}
interface Parser {
  safeParse(value: unknown): { success: boolean; data?: S23AssessmentReport };
}
/** 缓存仅来自生成钩子的报告，离线不伪造新成绩。按演示考试隔离，存储不可用时仍可联网阅读。 */
function currentExamKey(): string {
  try {
    return activeExamKey(window.location.search, sessionStorage.getItem("bk.dev.exam"));
  } catch {
    return activeExamKey(window.location.search, null);
  }
}
function cacheKey(reportId: string, examKey: string): string {
  return `S23.report:${examKey}:${reportId}`;
}
function readCache(key: string, examKey: string): S23AssessmentReport | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return undefined;
    const parser = (validators as Record<string, unknown>)["getAssessmentReportResponse"] as Parser;
    const parsed = parser.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data?.available && parsed.data.demo_exam_key === examKey ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
export function useAssessmentReport(reportId: string) {
  const examKey = currentExamKey();
  const key = cacheKey(reportId, examKey);
  const query = useGetAssessmentReport(reportId, {
    query: { queryKey: [...getGetAssessmentReportQueryKey(reportId), examKey], retry: shouldRetry },
  });
  const data = query.data?.demo_exam_key === examKey ? query.data : undefined;
  useEffect(() => {
    if (data?.available) {
      try {
        sessionStorage.setItem(key, JSON.stringify(data));
      } catch {
        /* 不能缓存不阻断阅读。 */
      }
    }
  }, [data, key]);
  return { ...reportView({ ...query, data }, readCache(key, examKey)), retry: () => void query.refetch() };
}
