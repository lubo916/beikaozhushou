import { getGetOralTrainingHomeQueryKey, isApiError, useGetOralTrainingHome, type S21OralTrainingHome } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < SERVER_ERROR_STATUS) return false;
  return failureCount < RETRY_LIMIT;
}

export interface OralQuery {
  readonly data: S21OralTrainingHome | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export type OralState = "loading" | "offline" | "error" | "restricted" | "empty" | "normal";
export interface OralView {
  readonly state: OralState;
  readonly data: S21OralTrainingHome | undefined;
  readonly stale: boolean;
}

export function oralView(query: OralQuery): OralView {
  const { data } = query;
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  // 有旧记录仍可查看；视频受限、样本不足只影响各自区块，不遮住其他训练内容。
  if (data !== undefined) return { state: data.assessment.available ? "normal" : "empty", data, stale: offline };
  if (offline) return { state: "offline", data, stale: false };
  if (query.status === "pending") return { state: "loading", data, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data, stale: false };
  return { state: "error", data, stale: false };
}

export function useOralTrainingHome(): OralView & { readonly retry: () => void } {
  const query = useGetOralTrainingHome({ query: { queryKey: getGetOralTrainingHomeQueryKey(), retry: shouldRetry } });
  return { ...oralView(query), retry: () => void query.refetch() };
}
