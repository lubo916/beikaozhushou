import { getGetS19NotebookQueryKey, isApiError, useGetS19Notebook, type S19Notebook } from "@exam-prep/contract";

export interface NotebookQuery {
  data: S19Notebook | undefined;
  error: unknown;
  status: "pending" | "error" | "success";
  fetchStatus: "fetching" | "paused" | "idle";
}

export function notebookView(query: NotebookQuery) {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined)
    return { state: query.data.items.length === 0 ? ("empty" as const) : ("normal" as const), data: query.data, stale: offline };
  if (offline) return { state: "offline" as const, data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading" as const, data: undefined, stale: false };
  return { state: "error" as const, data: undefined, stale: false };
}

export function useNotebook() {
  const query = useGetS19Notebook({
    query: { queryKey: getGetS19NotebookQueryKey(), retry: (count, error) => count < 1 && (!isApiError(error) || error.status >= 500) },
  });
  return { ...notebookView(query), retry: () => void query.refetch() };
}
