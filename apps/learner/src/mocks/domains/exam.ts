// 假数据（exam）：考试画像直接取 fixtures/exams/<考试 ID>/profile.json。
import { defineRoute } from "../route.ts";

export const routes = [defineRoute("getExamProfile", ({ db, params }) => db.examById(params["examId"] ?? "").profile)];
