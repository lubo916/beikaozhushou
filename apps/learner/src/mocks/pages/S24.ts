// S24 只读示例。无真实预测计算；所有业务数字取页面 fixture。
import type { S24Progress } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

const FILES = import.meta.glob<S24Progress>("../../../../../fixtures/pages/S24/*.json", { eager: true, import: "default" });

function progress(ctx: MockContext, mode = "normal"): S24Progress {
  const entry = Object.entries(FILES).find(([path]) => path.endsWith("/" + ctx.exam.examId + ".json"));
  if (entry === undefined) throw new Error("当前考试缺少进度演示数据");
  const data = structuredClone(entry[1]);
  if (mode === "empty") return { ...data, has_progress: false };
  if (mode === "restricted" || data.map_check === "blocked") {
    // feat:S24-07 阻断时在接口层移除所有预测、分值地图与阶梯数据。
    return {
      ...data,
      map_check: "blocked",
      blocked_reasons: data.blocked_reasons.length ? data.blocked_reasons : ["地图中存在缺少目标档的知识点"],
      forecasts: {},
      trend: [],
      score_bands: [],
      points: [],
      path: [],
    };
  }
  if (mode === "insufficient_data") {
    // 加宽区间是预置演示场景，不在组件中推算预测。
    const low = ctx.exam.key === "en" ? 200 : 40;
    const high = ctx.exam.key === "en" ? 400 : 80;
    if (data.forecasts.today) data.forecasts.today = { ...data.forecasts.today, conservative: low, optimistic: high, low_confidence: true };
    if (data.forecasts.target)
      data.forecasts.target = { ...data.forecasts.target, conservative: low, optimistic: high, low_confidence: true };
    return { ...data, evidence_count: 2 };
  }
  return data;
}

export const routes = [
  defineRoute("getS24Progress", (ctx) => progress(ctx), {
    variants: {
      empty: (ctx) => progress(ctx, "empty"),
      restricted: (ctx) => progress(ctx, "restricted"),
      locked: (ctx) => progress(ctx, "restricted"),
      insufficient_data: (ctx) => progress(ctx, "insufficient_data"),
    },
  }),
];
