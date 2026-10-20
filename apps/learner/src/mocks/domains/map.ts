// 假数据（map）：知识地图与单个知识点，取 fixtures/exams/<考试 ID>/knowledge-map.json。
import { defineRoute } from "../route.ts";

export const routes = [
  defineRoute("getKnowledgeMap", ({ db, params }) => db.examById(params["examId"] ?? "").map, {
    variants: { empty: ({ db, params }) => ({ ...db.examById(params["examId"] ?? "").map, chapters: [] }) },
  }),
  defineRoute("getKnowledgePoint", ({ db, params }) => db.knowledgePoint(params["pointId"] ?? "")),
];
