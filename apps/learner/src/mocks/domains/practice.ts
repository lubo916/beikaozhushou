// 假数据（practice）：取题、提交作答（写进内存仓库，错题本与今日清单跟着变）、错题列表。
import { defineRoute } from "../route.ts";

export const routes = [
  defineRoute("nextQuestion", ({ db, query, day }) => db.nextQuestion(query.get("pointId") ?? "", day)),
  defineRoute("submitAnswer", ({ db, body, now }) => db.submitAnswer(body, now)),
  defineRoute("listMistakes", ({ db, exam, query }) => db.listMistakes(exam, query.get("cursor"), query.get("limit")), {
    variants: { empty: () => ({ items: [], next_cursor: null, data_source: "sample" }) },
  }),
];
