// feat:S25-01 至 S25-11：页面示例来自独立 fixture，不推算业务数字。
import type { S25Calendar } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

const FILES = import.meta.glob("../../../../../fixtures/pages/S25/*.json", { eager: true, import: "default" });
type Extra = Omit<S25Calendar, "exam">;
function calendar(ctx: MockContext, availability: S25Calendar["availability"] = "normal"): S25Calendar {
  const entry = Object.entries(FILES).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`));
  if (entry === undefined) throw new Error("缺少考试日历演示数据");
  const data = structuredClone(entry[1]) as Extra;
  // 考试画像沿用公共契约；展示的是示例节点，不能当作实时官方安排。
  const exam = ctx.exam.profile as unknown as S25Calendar["exam"];
  if (availability === "empty") return { ...data, exam, availability, events: [], sessions: [], announcements: [] };
  if (availability === "insufficient_data") {
    data.events = data.events.map((event) => ({ ...event, status: "estimated", basis: "参考往年安排；官方尚未公布，等待正式核对" }));
  }
  return { ...data, exam, availability };
}
export const routes = [
  defineRoute("getExamCalendar", (ctx) => calendar(ctx), {
    variants: {
      empty: (ctx) => calendar(ctx, "empty"),
      restricted: (ctx) => calendar(ctx, "restricted"),
      insufficient_data: (ctx) => calendar(ctx, "insufficient_data"),
    },
  }),
];
