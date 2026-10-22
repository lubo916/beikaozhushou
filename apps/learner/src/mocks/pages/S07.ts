// S07-01～19：本任务只提供展示样例，不在页面或假数据层重算排程与预测。
import type { S07PlanOverview } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

const FILES = import.meta.glob<S07PlanOverview>("../../../../../fixtures/pages/S07/*.json", { eager: true, import: "default" });

export function planFixture(examId: string): S07PlanOverview {
  const found = Object.entries(FILES).find(([path]) => path.endsWith(`/${examId}.json`));
  if (found === undefined) throw new Error(`S07 缺少演示考试 ${examId} 的计划样例`);
  return structuredClone(found[1]);
}

function overview(ctx: MockContext): S07PlanOverview {
  return planFixture(ctx.exam.examId);
}

export const routes = [
  defineRoute("getS07PlanOverview", overview, {
    variants: {
      empty: (ctx) => ({ ...overview(ctx), has_plan: false }),
      restricted: (ctx) => ({ ...overview(ctx), institution_locked: true }),
      insufficient_data: (ctx) => ({ ...overview(ctx), health_estimated: true, observed_days: 6 }),
    },
  }),
];
