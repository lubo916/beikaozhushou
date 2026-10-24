// S26 简版的只读演示数据。是否挂载由配置决定，不按考试类别写业务分支。
// 加载、错误和离线由统一接口层制造，其余状态仅改变返回的数据。
import type { S26DecisionView } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

const FILES = import.meta.glob("../../../../../fixtures/pages/S26/*.json", { eager: true, import: "default" });

export function decisionFixture(examId: string): S26DecisionView {
  const fixture = Object.entries(FILES).find(([path]) => path.endsWith(`/${examId}.json`))?.[1];
  if (fixture === undefined) throw new Error(`缺少 S26 演示数据：${examId}`);
  return structuredClone(fixture) as S26DecisionView;
}

function decision(ctx: MockContext, mode = "normal"): S26DecisionView {
  const data = decisionFixture(ctx.exam.examId);
  if (mode === "empty") return { ...data, available: false, items: [] };
  if (mode === "restricted") return { ...data, access_limited: true };
  if (mode === "insufficient_data") return { ...data, profile_complete: false };
  return data;
}

export const routes = [
  defineRoute("getEnrollmentDecision", (ctx) => decision(ctx), {
    variants: {
      empty: (ctx) => decision(ctx, "empty"),
      restricted: (ctx) => decision(ctx, "restricted"),
      insufficient_data: (ctx) => decision(ctx, "insufficient_data"),
    },
  }),
];
