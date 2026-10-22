import { getGetEnrollmentDecisionQueryKey, isApiError, useGetEnrollmentDecision, type S26DecisionView } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR_STATUS) && failureCount < RETRY_LIMIT;
}

export interface DecisionQuery {
  readonly data: S26DecisionView | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export type DecisionState = "normal" | "loading" | "empty" | "error" | "offline" | "restricted" | "insufficient_data";

export function decisionView(query: DecisionQuery): {
  readonly state: DecisionState;
  readonly data: S26DecisionView | undefined;
  readonly stale: boolean;
} {
  const { data } = query;
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (data !== undefined) {
    let state: DecisionState = "normal";
    if (data.access_limited) state = "restricted";
    else if (!data.profile_complete) state = "insufficient_data";
    else if (!data.available) state = "empty";
    return { state, data, stale: offline };
  }
  if (offline) return { state: "offline", data, stale: false };
  if (query.status === "pending") return { state: "loading", data, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data, stale: false };
  return { state: "error", data, stale: false };
}

export function useDecision() {
  const query = useGetEnrollmentDecision({ query: { queryKey: getGetEnrollmentDecisionQueryKey(), retry: shouldRetry } });
  return { ...decisionView(query), retry: () => void query.refetch() };
}
