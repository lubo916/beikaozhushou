// 参数访问器（手写入口）。登记数据与类型由 registry.generated.ts 提供（spec_tool gen 生成，来源 contracts/params.yaml）；
// 取值来源与校验由 PLAT-02 重写。当前行为：未注入取值时返回登记默认值，数值取值夹在登记区间内。
import { PARAMS, type ParamName, type ParamValue } from "./registry.generated.ts";

export { PARAMS };
export type { ParamName, ParamValue };

/** 参数取值来源：返回 undefined 或 null 时取登记默认值。 */
export type ParamSource = (name: ParamName) => unknown;

let source: ParamSource = () => undefined;

/** 由运行时（参数中心）注入当前取值；未注入时取默认值。 */
export function setParamSource(fn: ParamSource): void {
  source = fn;
}

/** 读取参数。数值取值被夹在登记区间内。 */
export function param<K extends ParamName>(name: K): ParamValue<K> {
  const spec = PARAMS[name];
  const raw = source(name);
  if (raw === undefined || raw === null) return spec.default as unknown as ParamValue<K>;
  const range = spec.range as unknown as readonly [number, number] | null;
  if (typeof raw === "number" && range) {
    return Math.min(range[1], Math.max(range[0], raw)) as unknown as ParamValue<K>;
  }
  return raw as ParamValue<K>;
}
