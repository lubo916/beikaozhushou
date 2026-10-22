import type { S23Question } from "@exam-prep/contract";
/** 只筛选要展示的原始题目，不计算分数或归因。 */
export function reviewQuestions(questions: S23Question[], ids?: readonly string[]): S23Question[] {
  return ids === undefined ? questions : questions.filter((q) => ids.includes(q.id));
}
