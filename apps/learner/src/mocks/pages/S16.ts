// S16：只返回 fixtures 里的示例，不执行评分、不写掌握证据或调度记录。
// 加载、出错、离线由统一 MSW 接口层制造，其他状态由本页 variants 提供。
import type { S16Training } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import { defineRoute, type MockContext } from "../route.ts";

const FILES = import.meta.glob<S16Training>("../../../../../fixtures/pages/S16/*.json", { eager: true, import: "default" });

function training(ctx: MockContext): S16Training {
  const fixture = Object.entries(FILES).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`))?.[1];
  if (fixture === undefined) throw new ApiError("COMMON_NOT_FOUND", { exam_id: ctx.exam.examId });
  return structuredClone(fixture);
}

export const routes = [
  defineRoute("getRecitationTraining", training, {
    variants: {
      empty: (ctx) => ({ ...training(ctx), items: [] }),
      restricted: (ctx) => ({ ...training(ctx), oral_available: false }),
      insufficient_data: (ctx) => {
        const data = training(ctx);
        // 原始样本次数的演示值；页面按接口是否给 order 决定显示，不在页面比较阈值。
        data.last_result.oral_samples = 1;
        delete data.last_result.order;
        return data;
      },
    },
  }),
];
