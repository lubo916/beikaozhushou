// 全站共用的作答组件（U18a）：题干、九种作答形态、把握度（必选、无默认）、纸笔动作、题号导航、提交条（揭晓后锁定）。
// S04 摸底、S18 做题、S22 模考、错题回炉都用这一套；组件只管输入与显示，对错、证据、进度都由接口给（红线 5）。
// 公共组件入口 packages/ui/src/index.ts 还没导出这里（U18a-Q1＝A）：整合任务加一行 export * from "./quiz/index.ts" 之前，页面直接引这个文件。
export {
  QUIZ_CONFIDENCES,
  choosesOptions,
  emptyResponse,
  fromWireResponse,
  isAnswered,
  moveItem,
  setText,
  submitBlocker,
  textSlots,
  toWireResponse,
  toggleOption,
  type QuizConfidence,
  type QuizResponse,
  type QuizResponseForm,
  type QuizShape,
  type SubmitBlocker,
  type WireResponse,
} from "./answer.ts";
export { AnswerInput, type AnswerInputProps } from "./AnswerInput.tsx";
export { CALC_START, isOperator, pressDigit, pressEquals, pressKey, pressOperator, type CalcOperator, type CalcState } from "./calculator.ts";
export { ConfidencePicker, type ConfidencePickerProps } from "./ConfidencePicker.tsx";
export { Calculator, PaperTools, type PaperToolsProps } from "./PaperTools.tsx";
export { QuestionNav, type NavStatus, type QuestionNavItem, type QuestionNavProps } from "./QuestionNav.tsx";
export { QuestionStem, type QuestionStemProps } from "./QuestionStem.tsx";
export { SubmitBar, type SubmitBarProps } from "./SubmitBar.tsx";
export { default as QUIZ_COPY } from "./copy.zh-CN.json";
