import { getGetS14NotebookQueryKey, isApiError, useGetS14Notebook, type GetS14NotebookParams, type S14Notebook } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR_STATUS) && failureCount < RETRY_LIMIT;
}
export interface NotebookQuery {
  readonly data: S14Notebook | undefined;
  readonly error: unknown;
  readonly status: "pending" | "success" | "error";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export function notebookView(query: NotebookQuery) {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data)
    return {
      state: query.data.notes.length === 0 && query.data.favorites.length === 0 ? ("empty" as const) : ("normal" as const),
      data: query.data,
      stale: offline,
    };
  if (offline) return { state: "offline" as const, data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading" as const, data: undefined, stale: false };
  return {
    state: isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN" ? ("restricted" as const) : ("error" as const),
    data: undefined,
    stale: false,
  };
}
export function useNotebook(filters: GetS14NotebookParams) {
  const query = useGetS14Notebook(filters, {
    query: { queryKey: getGetS14NotebookQueryKey(filters), retry: shouldRetry, placeholderData: (previous) => previous },
  });
  return { ...notebookView(query), retry: () => void query.refetch() };
}
