// S32 仅读取示例；写入权限未登记，不调用真实导出/注销。
import { param } from "@exam-prep/params";
import { defineRoute, type MockContext } from "../route.ts";
const FILES = import.meta.glob("../../../../../fixtures/pages/S32/*.json", { eager: true, import: "default" });
export function privacyFixture(ctx: MockContext, state = "normal") {
  const file = Object.entries(FILES).find(([path]) => path.endsWith("/" + ctx.exam.examId + ".json"))?.[1];
  if (file === undefined || typeof file !== "object") throw new Error("S32 缺少演示考试数据");
  return {
    ...file,
    display_state: state,
    cooling_days: param("account.deregister.cooling_days"),
    deregistration_pending: state === "restricted",
  };
}
export const routes = [
  defineRoute("getPrivacyCenter", (ctx) => privacyFixture(ctx), {
    variants: {
      empty: (ctx) => ({ ...privacyFixture(ctx, "empty"), data_categories: [], tasks: [], shares: [], recycle: [], memories: [] }),
      restricted: (ctx) => privacyFixture(ctx, "restricted"),
      insufficient_data: (ctx) => privacyFixture(ctx, "insufficient_data"),
    },
  }),
];
