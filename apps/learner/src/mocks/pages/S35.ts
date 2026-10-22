// S35 假数据；通知纪律只读登记参数，页面不计算业务数字。写操作待整合登记后接入。
import { param } from "@exam-prep/params";
import { defineRoute, type MockContext } from "../route.ts";

type PageFixture = Record<string, unknown> & { readonly notifications: readonly unknown[] };
const FILES = import.meta.glob<PageFixture>("../../../../../fixtures/pages/S35/*.json", { eager: true, import: "default" });

function messages(ctx: MockContext, state = "normal") {
  const fixture = Object.entries(FILES).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`))?.[1];
  if (fixture === undefined) throw new Error("缺少 S35 演示数据");
  return {
    ...fixture,
    daily_cap: param("engagement.learning_notice.daily_cap"),
    quiet_hours: param("engagement.quiet_hours"),
    notifications: state === "empty" ? [] : fixture.notifications,
    push_enabled: state !== "restricted" && fixture["push_enabled"] === true,
    insufficient_data: state === "insufficient_data",
  };
}
export const routes = [
  defineRoute("getS35Messages", (ctx) => messages(ctx), {
    variants: {
      empty: (ctx) => messages(ctx, "empty"),
      restricted: (ctx) => messages(ctx, "restricted"),
      insufficient_data: (ctx) => messages(ctx, "insufficient_data"),
    },
  }),
];
