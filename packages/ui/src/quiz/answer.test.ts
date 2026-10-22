// 共用作答组件的纯函数：答完没有、差哪一步、作答与接口格式互换、计算器（U18a）。
import { describe, expect, it } from "vitest";
import { emptyResponse, fromWireResponse, isAnswered, moveItem, setText, submitBlocker, toWireResponse, toggleOption, type QuizShape } from "./answer.ts";
import { CALC_START, pressKey, type CalcState } from "./calculator.ts";

const single: QuizShape = { form: "choice", options: ["甲", "乙", "丙"] };
const blanks: QuizShape = { form: "fill", parts: ["成本", "投资收益"] };
const order: QuizShape = { form: "match_order", options: ["一", "二", "三"] };

describe("作答（answer.ts）", () => {
  it("选择题：没选不算答完；单选点谁换成谁，多选可以加减", () => {
    const empty = emptyResponse(single);
    expect(isAnswered(single, empty)).toBe(false);
    const one = toggleOption(empty, 2, false);
    expect(one.selected).toEqual([2]);
    expect(toggleOption(one, 0, false).selected).toEqual([0]);
    const many = toggleOption(toggleOption(empty, 2, true), 0, true);
    expect(many.selected).toEqual([0, 2]);
    expect(toggleOption(many, 2, true).selected).toEqual([0]);
  });

  it("固定流程：先作答，再选把握度；把握度关着时不用选", () => {
    const answered = toggleOption(emptyResponse(single), 1, false);
    expect(submitBlocker(single, emptyResponse(single), null, true)).toBe("answer");
    expect(submitBlocker(single, answered, null, true)).toBe("confidence");
    expect(submitBlocker(single, answered, "vague", true)).toBeNull();
    expect(submitBlocker(single, answered, null, false)).toBeNull();
  });

  it("填空：每个空都填了才算答完；交给接口时按换行连起来，拿回来再拆开", () => {
    const half = setText(emptyResponse(blanks), 0, "200");
    expect(isAnswered(blanks, half)).toBe(false);
    const full = setText(half, 1, " 1 ");
    expect(isAnswered(blanks, full)).toBe(true);
    const wire = toWireResponse(blanks, full);
    expect(wire).toEqual({ text: "200\n1" });
    expect(fromWireResponse(blanks, wire).texts).toEqual(["200", "1"]);
  });

  it("排序：一开始按原次序摆好就算答完；挪到头不再动", () => {
    const start = emptyResponse(order);
    expect(start.selected).toEqual([0, 1, 2]);
    expect(isAnswered(order, start)).toBe(true);
    expect(moveItem(start, 2, -1).selected).toEqual([0, 2, 1]);
    expect(moveItem(start, 0, -1)).toBe(start);
    expect(toWireResponse(order, moveItem(start, 0, 1))).toEqual({ selected: [1, 0, 2] });
  });

  it("简答、口述只交一段文字；实操自评一项不勾也算作答", () => {
    expect(toWireResponse({ form: "written" }, setText(emptyResponse({ form: "written" }), 0, "要点"))).toEqual({ text: "要点" });
    expect(isAnswered({ form: "practical_self", parts: ["一"] }, emptyResponse({ form: "practical_self" }))).toBe(true);
    expect(isAnswered({ form: "oral" }, emptyResponse({ form: "oral" }))).toBe(false);
  });
});

describe("计算器（calculator.ts）", () => {
  const run = (keys: string): CalcState => [...keys].reduce(pressKey, CALC_START);

  it("四则运算、连续运算与小数", () => {
    expect(run("206-6=").display).toBe("200");
    expect(run("12+3*2=").display).toBe("30");
    expect(run("0.1+0.2=").display).toBe("0.3");
  });

  it("除以 0 显示算不出来，再按数字从头开始", () => {
    const failed = run("5/0=");
    expect(failed.error).toBe(true);
    expect(pressKey(failed, "7").display).toBe("7");
  });
});
