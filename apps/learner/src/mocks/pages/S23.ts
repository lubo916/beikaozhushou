// S23：所有业务数字直接取演示报告；页面不计算成绩、百分位或补强排序。
import type { S23AssessmentReport } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";
const FILES = import.meta.glob("../../../../../fixtures/pages/S23/*.json", { eager: true, import: "default" });
export function reportFixture(examId: string): S23AssessmentReport {
  const entry = Object.entries(FILES).find(([path]) => path.endsWith(`/${examId}.json`));
  if (entry === undefined) throw new Error(`没有测评报告演示数据：${examId}`);
  return structuredClone(entry[1]) as S23AssessmentReport;
}
function report(ctx: MockContext): S23AssessmentReport {
  return reportFixture(ctx.exam.examId);
}
export const routes = [
  defineRoute("getAssessmentReport", report, {
    variants: {
      empty: (ctx) => ({ ...report(ctx), available: false }),
      restricted: (ctx) => {
        const data = report(ctx);
        return {
          ...data,
          pending_grading: 1,
          questions: data.questions.map((q, index) =>
            index === data.questions.length - 1 ? { ...q, pending_grading: true, correct: null, score: 0 } : q,
          ),
        };
      },
      insufficient_data: (ctx) => {
        const data = report(ctx);
        return { ...data, summary: { ...data.summary, rank_visible: false, sample_count: 36 } };
      },
    },
  }),
];
