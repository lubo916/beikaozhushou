import { getGetS33SettingsQueryKey, isApiError, useGetS33Settings, type S33Settings } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR = 500;
export function shouldRetry(count: number, error: unknown): boolean {
  return count < RETRY_LIMIT && (!isApiError(error) || error.status >= SERVER_ERROR);
}
export interface SettingsQuery {
  data: S33Settings | undefined;
  error: unknown;
  status: "pending" | "success" | "error";
  fetchStatus: "idle" | "fetching" | "paused";
}
export function settingsView(query: SettingsQuery) {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.page_state, data: query.data, stale: offline };
  if (offline) return { state: "offline" as const, data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading" as const, data: undefined, stale: false };
  return {
    state: isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN" ? ("restricted" as const) : ("error" as const),
    data: undefined,
    stale: false,
  };
}
export function useSettings() {
  const query = useGetS33Settings({ query: { queryKey: getGetS33SettingsQueryKey(), retry: shouldRetry } });
  return { ...settingsView(query), retry: () => void query.refetch() };
}
