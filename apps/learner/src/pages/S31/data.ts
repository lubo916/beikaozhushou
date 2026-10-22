import { getGetS31MembershipQueryKey, isApiError, useGetS31Membership, type S31Membership } from "@exam-prep/contract";

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < SERVER_ERROR_STATUS) return false;
  return failureCount < RETRY_LIMIT;
}
export interface MembershipQuery {
  readonly data: S31Membership | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}
export interface MembershipView {
  readonly state: S31Membership["view_state"] | "loading" | "error" | "offline";
  readonly data: S31Membership | undefined;
  readonly stale: boolean;
}
export function membershipView(query: MembershipQuery): MembershipView {
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) return { state: query.data.view_state, data: query.data, stale: offline };
  if (offline) return { state: "offline", data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data: undefined, stale: false };
  return { state: "error", data: undefined, stale: false };
}
/** 仅组合生成钩子；额度、权益、金额及试算结果都由接口返回。 */
export function useMembership() {
  const query = useGetS31Membership({ query: { queryKey: getGetS31MembershipQueryKey(), retry: shouldRetry } });
  return { ...membershipView(query), retry: () => void query.refetch() };
}
