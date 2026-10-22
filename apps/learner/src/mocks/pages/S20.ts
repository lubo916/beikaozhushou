// S20：规则尚未接入，四考试整份响应均为 sample；七态由接口层制造。
import type { S20Workspace } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

const FILES = import.meta.glob("../../../../../fixtures/pages/S20/*.json", { eager: true, import: "default" });
export function gradingFixture(examId: string): S20Workspace {
  const entry = Object.entries(FILES).find(([path]) => path.endsWith(`/${examId}.json`));
  if (entry === undefined) throw new Error(`S20 缺少演示考试数据：${examId}`);
  return structuredClone(entry[1]) as S20Workspace;
}
function workspace(ctx: MockContext, mode = "normal"): S20Workspace {
  const data = gradingFixture(ctx.exam.examId);
  if (mode === "empty") return { ...data, submission: null, points: [], annotations: [], score: null };
  if (mode === "restricted") return { ...data, availability: "restricted", score: null };
  if (mode === "insufficient_data")
    return { ...data, availability: "insufficient_data", rubric: { ...data.rubric, available: false }, score: null };
  return data;
}
export const routes = [
  defineRoute("getGradingWorkspace", (ctx) => workspace(ctx), {
    variants: {
      empty: (ctx) => workspace(ctx, "empty"),
      restricted: (ctx) => workspace(ctx, "restricted"),
      insufficient_data: (ctx) => workspace(ctx, "insufficient_data"),
    },
  }),
];
