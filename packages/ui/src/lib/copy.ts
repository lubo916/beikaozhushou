import { interpolate, type InterpolationValues } from "@exam-prep/shared/format";
import copy from "../copy.zh-CN.json";

/** 组件的默认文案（copy.zh-CN.json）。页面可以逐项传入自己的文案覆盖；规则数字一律用占位符（如 {{days}}），取值由页面经参数访问器读后传入。 */
export const COPY = copy;

/** 把文案里的 {{名字}} 换成取值。 */
export function fill(template: string, values: InterpolationValues = {}): string {
  return interpolate(template, values);
}
