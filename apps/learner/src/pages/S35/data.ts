import { getGetS35MessagesQueryKey, isApiError, useGetS35Messages, type S35Messages } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR_STATUS) && failureCount < RETRY_LIMIT;
}
export interface MessagesQuery {
  readonly data: S35Messages | undefined;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
  readonly error: unknown;
}
export function messagesView(query: MessagesQuery) {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined)
    return { state: query.data.notifications.length === 0 ? ("empty" as const) : ("normal" as const), data: query.data, stale: offline };
  if (offline) return { state: "offline" as const, data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading" as const, data: undefined, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN")
    return { state: "restricted" as const, data: undefined, stale: false };
  return { state: "error" as const, data: undefined, stale: false };
}
export function useMessages() {
  const query = useGetS35Messages({ query: { queryKey: getGetS35MessagesQueryKey(), retry: shouldRetry } });
  return { ...messagesView(query), retry: () => void query.refetch() };
}
