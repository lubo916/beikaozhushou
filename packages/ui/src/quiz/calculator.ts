// 计算器（纸笔动作，S18-05）：四则运算的按键状态机，纯函数；组件只负责显示与按键。不是业务计算，只是做题时的草稿工具。

export type CalcOperator = "+" | "-" | "*" | "/";

export interface CalcState {
  readonly display: string;
  readonly stored: number | null;
  readonly operator: CalcOperator | null;
  /** 下一次按数字时从头输入（刚按过运算符或等号）。 */
  readonly fresh: boolean;
  /** 除以 0 等算不出来的情况。 */
  readonly error: boolean;
}

export const CALC_START: CalcState = { display: "0", stored: null, operator: null, fresh: true, error: false };

/** 显示的有效数字位数：避免 0.1 + 0.2 显示成一长串。 */
const PRECISION = 12;
/** 最多输入几位数字。 */
const MAX_DIGITS = 16;

const OPERATORS: readonly string[] = ["+", "-", "*", "/"];

export function isOperator(key: string): key is CalcOperator {
  return OPERATORS.includes(key);
}

function apply(left: number, right: number, operator: CalcOperator): number | null {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return right === 0 ? null : left / right;
  }
}

function show(value: number): string {
  return String(Number(value.toPrecision(PRECISION)));
}

export function pressDigit(state: CalcState, digit: string): CalcState {
  if (state.error) return pressDigit(CALC_START, digit);
  if (digit === ".") {
    if (state.fresh) return { ...state, display: "0.", fresh: false };
    return state.display.includes(".") ? state : { ...state, display: `${state.display}.` };
  }
  if (state.fresh || state.display === "0") return { ...state, display: digit, fresh: false };
  if (state.display.replace(/[-.]/g, "").length >= MAX_DIGITS) return state;
  return { ...state, display: `${state.display}${digit}` };
}

export function pressOperator(state: CalcState, operator: CalcOperator): CalcState {
  if (state.error) return state;
  const current = Number(state.display);
  if (state.operator !== null && state.stored !== null && !state.fresh) {
    const value = apply(state.stored, current, state.operator);
    if (value === null) return { ...CALC_START, error: true };
    return { display: show(value), stored: value, operator, fresh: true, error: false };
  }
  return { ...state, stored: current, operator, fresh: true };
}

export function pressEquals(state: CalcState): CalcState {
  if (state.error || state.operator === null || state.stored === null) return state;
  const value = apply(state.stored, Number(state.display), state.operator);
  if (value === null) return { ...CALC_START, error: true };
  return { display: show(value), stored: null, operator: null, fresh: true, error: false };
}

/** 一次按键：数字与小数点、运算符、等号。 */
export function pressKey(state: CalcState, key: string): CalcState {
  if (key === "=") return pressEquals(state);
  if (isOperator(key)) return pressOperator(state, key);
  return pressDigit(state, key);
}
