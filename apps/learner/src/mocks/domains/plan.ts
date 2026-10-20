// 假数据（plan）：今日清单（按模拟的“今天”与内存里的作答算进度）、学习计划与提议；规则落地前都标 data_source: sample。
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
  defineRoute("getCurrentPlan", ({ db, exam }) => db.currentPlan(exam)),
  defineRoute("listProposals", ({ db, exam, query }) => db.listProposals(exam, query.get("cursor"), query.get("limit"))),
];
