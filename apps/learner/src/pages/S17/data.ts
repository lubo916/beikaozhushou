// S17 只经生成的钩子拿数据；七态由模拟层制造，再按请求结果映射。
// 受限与数据不足只影响 AI 出题/补题卡，审定题和自有题练习照常。
import { getGetPracticeCenterQueryKey, isApiError, useGetPracticeCenter, type S17PracticeCenter } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < SERVER_ERROR_STATUS) return false;
  return failureCount < RETRY_LIMIT;
}

export type PracticeState = "loading" | "error" | "offline" | "restricted" | "empty" | "normal";

export interface PracticeQuery {
  readonly data: S17PracticeCenter | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}

export interface PracticeView {
  readonly state: PracticeState;
  readonly data: S17PracticeCenter | undefined;
  readonly stale: boolean;
}

function isOffline(query: PracticeQuery): boolean {
  return query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
}

export function practiceView(query: PracticeQuery): PracticeView {
  const { data } = query;
  if (data !== undefined) return { state: data.availability === "empty" ? "empty" : "normal", data, stale: isOffline(query) };
  if (isOffline(query)) return { state: "offline", data, stale: false };
  if (query.status === "pending") return { state: "loading", data, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data, stale: false };
  return { state: "error", data, stale: false };
}

export function usePracticeCenter(): PracticeView & { readonly retry: () => void } {
  const query = useGetPracticeCenter({ query: { queryKey: getGetPracticeCenterQueryKey(), retry: shouldRetry } });
  return { ...practiceView(query), retry: () => void query.refetch() };
}
