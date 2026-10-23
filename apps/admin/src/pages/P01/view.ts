// P01 的七态判断：把请求结果映射成一态（ui-rules 第 13 节）。页面不为 ?state= 写分支。
import { isApiError } from "@exam-prep/contract/errors";
import type { P01Cockpit } from "@exam-prep/contract";
import type { PageQuery } from "./runtime.ts";

export type CockpitState = "normal" | "loading" | "empty" | "error" | "offline" | "restricted" | "insufficient_data";

export interface CockpitView {
  readonly state: CockpitState;
  readonly data: P01Cockpit | undefined;
  /** 有旧数据但断网：照常显示，顶上加离线提示。 */
  readonly stale: boolean;
}

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;

/** 网络或服务异常再试一次；4xx 不重试（F08-Q3）。 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return (!isApiError(error) || error.status >= SERVER_ERROR_STATUS) && failureCount < RETRY_LIMIT;
}

export function cockpitView(query: PageQuery<P01Cockpit>): CockpitView {
  // 权限拒绝优先于旧数据：授权被收回时不再显示断网前的缓存。
  if (query.status === "error" && isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN")
    return { state: "restricted", data: undefined, stale: false };
  // 服务端明确报错时展示错误与重试，不能把缓存伪装成一次成功刷新。
  if (query.status === "error" && isApiError(query.error)) return { state: "error", data: undefined, stale: false };
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  const data = query.data;
  if (data !== undefined) {
    const empty = data.funnel.length === 0 && data.retention.groups.length === 0 && data.alerts.length === 0;
    const state: CockpitState = empty ? "empty" : data.sample_sufficient ? "normal" : "insufficient_data";
    return { state, data, stale: offline };
  }
  if (offline) return { state: "offline", data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false };
  return { state: "error", data: undefined, stale: false };
}
