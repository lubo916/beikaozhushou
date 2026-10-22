// S01 数据只经生成的钩子取得；七态由接口层制造，页面不解析 ?state=。
import { getGetWelcomeQueryKey, isApiError, useGetWelcome, type S01WelcomeData } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !(isApiError(error) && error.status < SERVER_ERROR_STATUS) && failureCount < RETRY_LIMIT;
}

export type WelcomeState = "loading" | "error" | "offline" | "restricted" | "empty" | "insufficient_data" | "normal";
export interface WelcomeQuery {
  readonly data: S01WelcomeData | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export interface WelcomeView {
  readonly state: WelcomeState;
  readonly data: S01WelcomeData | undefined;
  readonly stale: boolean;
}

export function welcomeView(query: WelcomeQuery): WelcomeView {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) {
    const state = query.data.availability === "ready" ? "normal" : query.data.availability;
    return { state, data: query.data, stale: offline };
  }
  if (offline) return { state: "offline", data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false };
  return {
    state: isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN" ? "restricted" : "error",
    data: undefined,
    stale: false,
  };
}

export function useWelcome(): WelcomeView & { readonly retry: () => void } {
  const query = useGetWelcome({ query: { queryKey: getGetWelcomeQueryKey(), retry: shouldRetry } });
  return { ...welcomeView(query), retry: () => void query.refetch() };
}
