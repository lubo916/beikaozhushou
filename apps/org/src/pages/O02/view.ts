import { isApiError } from "@exam-prep/contract/errors";
import type { O02Lead, O02Leads } from "@exam-prep/contract";

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
  // 查询保留旧数据时，权限撤销仍须立即遮蔽联系信息。
  if (query.status === "error" && isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN")
    return { state: "restricted", data: undefined, stale: false };
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  if (query.data !== undefined) {
    const state =
      query.data.access === "restricted"
        ? "restricted"
        : query.data.sample_sufficient && query.data.leads.length === 0
          ? "empty"
          : "normal";
    return { state, data: query.data, stale: offline };
  }
  if (offline) return { state: "offline", data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false };
  if (isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN") return { state: "restricted", data: undefined, stale: false };
  return { state: "error", data: undefined, stale: false };
}

/** 线索弹窗当前可显示的内容。 */
export function visibleLead(selection: O02Lead | undefined, home: { state: O02State; data: O02Leads | undefined }): O02Lead | undefined {
  if (selection === undefined || home.state !== "normal" || home.data?.access !== "authorized") return undefined;
  return home.data.leads.find((lead) => lead.id === selection.id);
}
