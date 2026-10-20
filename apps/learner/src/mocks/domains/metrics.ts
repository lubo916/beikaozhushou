// 假数据（metrics）：埋点只记在内存里，回 202、没有响应体。
import { defineRoute } from "../route.ts";

export const routes = [
  defineRoute(
    "trackEvent",
    ({ db, body }) => {
      db.trackEvent(body);
      return undefined;
    },
    { status: 202 },
  ),
];
