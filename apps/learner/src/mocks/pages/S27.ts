// S27 规则尚未接通：所有数字取页面 fixture，并显式标为示例数据。页面不重算。
import type { S27SprintHome } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

const files = import.meta.glob<S27SprintHome>("../../../../../fixtures/pages/S27/*.json", { eager: true, import: "default" });

export function sprintHome(ctx: MockContext): S27SprintHome {
  const fixture = Object.entries(files).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`))?.[1];
  if (fixture === undefined) throw new Error("当前演示考试缺少冲刺示例");
  return { ...structuredClone(fixture), exam_id: ctx.exam.examId, exam_name: ctx.exam.profile.name };
}

export const routes = [
  defineRoute("getS27SprintHome", sprintHome, {
    variants: {
      empty: (ctx) => ({ ...sprintHome(ctx), availability: "not_yet" }),
      restricted: (ctx) => ({ ...sprintHome(ctx), availability: "exam_day" }),
      insufficient_data: (ctx) => ({
        ...sprintHome(ctx),
        calibration_ready: false,
        grades: sprintHome(ctx).grades.map((grade) => ({
          subject_key: grade.subject_key,
          forecast_low: grade.forecast_low,
          forecast_high: grade.forecast_high,
        })),
      }),
    },
  }),
];
