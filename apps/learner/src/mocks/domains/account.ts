// 假数据（account）：示范接口 GET /api/v1/me/context——当前用户、当前目标考试（开发工具条选的演示考试）与今天。
import { defineRoute } from "../route.ts";

export const routes = [
  defineRoute("getMeContext", ({ db, exam, now }) => db.meContext(exam, now), {
    variants: { empty: ({ db, now }) => db.meContext(null, now) },
  }),
];
