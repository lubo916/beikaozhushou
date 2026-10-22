import type { S33Settings } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

const files = import.meta.glob<S33Settings>("../../../../../fixtures/pages/S33/*.json", { eager: true, import: "default" });
function settings(ctx: MockContext, state: S33Settings["page_state"] = "normal"): S33Settings {
  const fixture = Object.entries(files).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`))?.[1];
  if (fixture === undefined) throw new Error("S33 缺少当前演示考试的设置数据");
  return { ...fixture, page_state: state };
}
export const routes = [
  defineRoute("getS33Settings", (ctx) => settings(ctx), {
    variants: {
      empty: (ctx) => settings(ctx, "empty"),
      restricted: (ctx) => settings(ctx, "restricted"),
      insufficient_data: (ctx) => settings(ctx, "insufficient_data"),
    },
  }),
];
