import { getGetS08RecapQueryKey, isApiError, useGetS08Recap, type S08Report, type S08Period } from "@exam-prep/contract";
const RETRIES = 1;
const SERVER_ERROR = 500;
export function shouldRetry(count: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR) && count < RETRIES;
}
export interface RecapQuery {
  data: S08Report | undefined;
  error: unknown;
  status: "pending" | "success" | "error";
  fetchStatus: "fetching" | "paused" | "idle";
}
export function recapView(query: RecapQuery) {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.availability, data: query.data, offline };
  return { state: offline ? "offline" : query.status === "pending" ? "loading" : "error", data: undefined, offline };
}
export function useRecap(view: S08Period) {
  const query = useGetS08Recap({ view }, { query: { queryKey: getGetS08RecapQueryKey({ view }), retry: shouldRetry } });
  return { ...recapView(query), retry: () => void query.refetch() };
}
