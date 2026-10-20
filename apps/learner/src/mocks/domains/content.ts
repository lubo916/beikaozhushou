// 假数据（content）：题目（揭晓前不含答案）、答案与解析（作答过才给）、卡片。
import { defineRoute } from "../route.ts";

export const routes = [
  defineRoute("getQuestion", ({ db, params }) => db.questionView(params["questionId"] ?? "")),
  defineRoute("getQuestionSolution", ({ db, params }) => db.solution(params["questionId"] ?? "")),
  defineRoute("getCard", ({ db, params }) => db.card(params["cardId"] ?? "")),
];
