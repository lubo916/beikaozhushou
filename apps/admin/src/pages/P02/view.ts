// P02 的七态判断：把请求结果映射成一态（ui-rules 第 13 节）。页面不为 ?state= 写分支。
import { isApiError } from "@exam-prep/contract/errors";
import type { P02MetricDictionary } from "@exam-prep/contract";
import type { PageQuery } from "../P01/runtime.ts";

export type DictionaryState = "normal" | "loading" | "empty" | "error" | "offline" | "restricted" | "insufficient_data";

export interface DictionaryView {
  readonly state: DictionaryState;
  readonly data: P02MetricDictionary | undefined;
  readonly stale: boolean;
}

const RETRY_LIMIT = 1;
const SERVER_ERROR_STATUS = 500;

/** 网络或服务异常再试一次；4xx 不重试（F08-Q3）。 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return (!isApiError(error) || error.status >= SERVER_ERROR_STATUS) && failureCount < RETRY_LIMIT;
}

export function dictionaryView(query: PageQuery<P02MetricDictionary>): DictionaryView {
  if (query.status === "error" && isApiError(query.error) && query.error.code === "COMMON_FORBIDDEN")
    return { state: "restricted", data: undefined, stale: false };
  const offline = query.fetchStatus === "paused" || (query.status === "error" && !isApiError(query.error));
  const data = query.data;
  if (data !== undefined) {
    // 只和“数据质量”卡有关的样本不足只在那张卡里提示，字典照常显示（F08-Q1）。
    const state: DictionaryState = data.items.length === 0 ? "empty" : data.quality.sample_sufficient ? "normal" : "insufficient_data";
    return { state, data, stale: offline };
  }
  if (offline) return { state: "offline", data: undefined, stale: false };
  if (query.status === "pending") return { state: "loading", data: undefined, stale: false };
  return { state: "error", data: undefined, stale: false };
}
