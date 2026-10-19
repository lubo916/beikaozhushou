import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { PARAMS, param, setParamSource, type ParamValue } from "./index.ts";

describe("参数访问器（手写入口，数据来自 registry.generated.ts）", () => {
  afterEach(() => setParamSource(() => undefined));

  it("未注入取值时返回登记默认值", () => {
    expect(param("api.page.max_limit")).toBe(PARAMS["api.page.max_limit"].default);
    expect(param("engagement.quiet_hours")).toEqual(PARAMS["engagement.quiet_hours"].default);
  });

  it("注入的数值夹在登记区间内", () => {
    const [low, high] = PARAMS["api.page.max_limit"].range;
    setParamSource(() => high + 1);
    expect(param("api.page.max_limit")).toBe(high);
    setParamSource(() => low - 1);
    expect(param("api.page.max_limit")).toBe(low);
  });

  it("登记数据带整数标记：YAML 默认值为整数的参数为 true", () => {
    expect(PARAMS["api.page.max_limit"].integer).toBe(true);
    expect(PARAMS["learner.evidence.fast_answer_ratio"].integer).toBe(false);
    expect(PARAMS["plan.disconnect.tiers_days"].integer).toBe(false);
  });

  it("类型：参数名受登记约束，取值类型按默认值放宽（由 pnpm typecheck 检查）", () => {
    expectTypeOf(param("api.page.max_limit")).toEqualTypeOf<number>();
    expectTypeOf<ParamValue<"engagement.quiet_hours">>().toEqualTypeOf<string[]>();
    expectTypeOf<ParamValue<"learner.evidence.strength_weights">["strong"]>().toEqualTypeOf<number>();
    // @ts-expect-error 未登记的参数名不能读取
    const readUnknown = () => param("unknown");
    expect(readUnknown).toBeTypeOf("function");
  });
});
