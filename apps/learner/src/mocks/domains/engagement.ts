// 假数据（engagement）：站内通知（示例）。
import { defineRoute } from "../route.ts";

export const routes = [
  defineRoute("listNotifications", ({ db, exam, query }) => db.listNotifications(exam, query.get("cursor"), query.get("limit"))),
];
