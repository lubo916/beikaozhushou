import { isApiError, useGetO02Leads, type O02Leads } from "@exam-prep/contract";
import { useLocation } from "../../router/history.tsx";

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < SERVER_ERROR_STATUS) return false;
  return failureCount < RETRY_LIMIT;
}
export type O02State = "normal" | "loading" | "empty" | "error" | "offline" | "restricted";
export interface O02Query {
  readonly data: O02Leads | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export function leadsView(query: O02Query): { state: O02State; data: O02Leads | undefined; stale: boolean } {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) {
    const state = query.data.access === "restricted" ? "restricted" : query.data.leads.length === 0 ? "empty" : "normal";
    return { state, data: query.data, stale: offline };
  }
  if (offline) return { state: "offline", data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data: undefined, stale: false };
  return { state: "error", data: undefined, stale: false };
}
export function useLeads() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const query = useGetO02Leads(
    { exam: params.get("exam") ?? "kj", state: params.get("state") ?? "normal" },
    { query: { retry: shouldRetry } },
  );
  return { ...leadsView(query), retry: () => void query.refetch() };
}
