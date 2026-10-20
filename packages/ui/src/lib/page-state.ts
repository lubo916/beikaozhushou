import { PAGE_STATE_CODES, type PageStateCode } from "@exam-prep/shared/vocab";

export interface PageStateSearchOptions {
  /** 只在开发与测试时生效（ui-rules 第 4、5 节）；页面传 import.meta.env.DEV。 */
  readonly enabled?: boolean | undefined;
  /** 本页有哪些状态（没有锁定态的页面去掉 locked）。 */
  readonly allowed?: readonly PageStateCode[] | undefined;
}

/** 读 ?state= 强制页面状态；不认识的取值或未开启时按正常显示。 */
export function pageStateFromSearch(search: string, options: PageStateSearchOptions = {}): PageStateCode {
  if (options.enabled === false) return "normal";
  const value = new URLSearchParams(search).get("state");
  return (options.allowed ?? PAGE_STATE_CODES).find((code) => code === value) ?? "normal";
}
