import { formatNumber } from "./number.ts";

// 文案插值（ui-rules 第 6 节）：规则数字一律经占位符传入，如“间隔 {{days}} 天做对 {{times}} 次”，取值由调用方经参数访问器读。
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;
const BARE_NUMBER = /[0-9０-９]+(?:[.．][0-9０-９]+)?/g;

export type InterpolationValues = Readonly<Record<string, string | number>>;

/** 把 {{名字}} 换成取值；没给的占位符原样保留，便于发现漏传。 */
export function interpolate(template: string, values: InterpolationValues): string {
  return template.replace(PLACEHOLDER, (whole: string, name: string) => {
    const value = values[name];
    if (value === undefined) return whole;
    return typeof value === "number" ? formatNumber(value) : value;
  });
}

/** 找出文案里占位符以外的阿拉伯数字（含全角）：规则数字要用占位符，不能写死。 */
export function findBareNumbers(text: string): string[] {
  return text.replace(PLACEHOLDER, "").match(BARE_NUMBER) ?? [];
}
