import { getGetS07PlanOverviewQueryKey, isApiError, useGetS07PlanOverview, type S07PlanOverview } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < SERVER_ERROR_STATUS) return false;
  return failureCount < RETRY_LIMIT;
}
export interface PlanQuery {
  readonly data: S07PlanOverview | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export function planView(query: PlanQuery) {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.has_plan ? "normal" : "empty", data: query.data, offline } as const;
  if (offline) return { state: "offline", data: undefined, offline: true } as const;
  if (query.status === "pending") return { state: "loading", data: undefined, offline: false } as const;
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN")
    return { state: "restricted", data: undefined, offline: false } as const;
  return { state: "error", data: undefined, offline: false } as const;
}
export function usePlanOverview() {
  const query = useGetS07PlanOverview({ query: { queryKey: getGetS07PlanOverviewQueryKey(), retry: shouldRetry } });
  return { ...planView(query), retry: () => void query.refetch() };
}

export const VIEWS = ["week", "scope", "ranking", "log", "calendar", "rounds", "today", "sandbox"] as const;
export type PlanView = (typeof VIEWS)[number];
export function readView(value: string | null): PlanView {
  return VIEWS.find((view) => view === value) ?? "week";
}
