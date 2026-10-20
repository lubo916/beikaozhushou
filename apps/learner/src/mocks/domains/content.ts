// 假数据（content）：题目（揭晓前不含答案）、答案与解析（作答过才给）、卡片、笔记与资料。
import { defineRoute } from "../route.ts";

export const routes = [
  defineRoute("getQuestion", ({ db, params }) => db.questionView(params["questionId"] ?? "")),
  defineRoute("getQuestionSolution", ({ db, params }) => db.solution(params["questionId"] ?? "")),
  defineRoute("getCard", ({ db, params }) => db.card(params["cardId"] ?? "")),
  defineRoute("listNotes", ({ db, exam, query }) => db.listNotes(exam, query.get("cursor"), query.get("limit"))),
  defineRoute("listMaterials", ({ db, exam, query }) => db.listMaterials(exam, query.get("cursor"), query.get("limit"))),
];
