import { getGetExamCalendarQueryKey, isApiError, useGetExamCalendar, type S25Calendar } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR = 500;
export function shouldRetry(count: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR) && count < RETRY_LIMIT;
}
export interface CalendarQuery {
  readonly data: S25Calendar | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export type CalendarState = "normal" | "loading" | "error" | "offline" | "restricted" | "empty" | "insufficient_data";
export function calendarView(query: CalendarQuery): { state: CalendarState; data: S25Calendar | undefined; stale: boolean } {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.availability, data: query.data, stale: offline };
  if (offline) return { state: "offline", data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data: undefined, stale: false };
  return { state: "error", data: undefined, stale: false };
}
export function useCalendar() {
  const query = useGetExamCalendar({ query: { queryKey: getGetExamCalendarQueryKey(), retry: shouldRetry } });
  return { ...calendarView(query), retry: () => void query.refetch() };
}
