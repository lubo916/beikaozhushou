// S34 的展示数字来自四份 fixture；真实归档尚未接通，标示例数据。
import type { S34GrowthProfile } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

const FILES = import.meta.glob<S34GrowthProfile>("../../../../../fixtures/pages/S34/*.json", { eager: true, import: "default" });

function profile(ctx: MockContext): S34GrowthProfile {
  const match = Object.entries(FILES).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`))?.[1];
  if (match === undefined) throw new Error(`S34 缺少演示考试 ${ctx.exam.examId}`);
  return structuredClone(match);
}

function empty(ctx: MockContext): S34GrowthProfile {
  return {
    ...profile(ctx),
    stats: { goals: 0, effective_weeks: 0, graduated_mistakes: 0, mastered_points: 0 },
    goals: [],
    milestones: [],
    abilities: [],
    packages: [],
    history: [],
    comparison: { available: false, attempts: 0, items: [] },
  };
}

function single(ctx: MockContext): S34GrowthProfile {
  const data = profile(ctx);
  return { ...data, history: data.history.slice(0, 1), comparison: { available: false, attempts: 1, items: [] } };
}

export const routes = [
  defineRoute("getGrowthProfile", profile, {
    variants: {
      empty,
      // bk spec：受限不适用；返回正常档案和页内轻量提示标志。
      restricted: (ctx) => ({ ...profile(ctx), restriction_not_applicable: true }),
      insufficient_data: single,
    },
  }),
];
