// 假数据（plan）：今日清单（示例；排法规则落地前标 data_source: sample），按模拟的“今天”与内存里的作答算进度。
import { defineRoute } from "../route.ts";

export const routes = [
  defineRoute("getTodayList", ({ db, exam, day }) => db.todayList(exam, day), {
    variants: {
      empty: ({ exam, day }) => ({
        day,
        exam_id: exam.examId,
        segments: ["consolidate", "advance", "closing"].map((segment) => ({ segment, tasks: [] })),
        data_source: "sample",
      }),
    },
  }),
];
