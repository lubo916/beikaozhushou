// S17 练习中心：模拟接口一次返回本页演示数据；业务数字与档位快照均取 fixture，不在页面计算。
// feat:S17-05 四级可信度决定证据上限；前端展示分级说明，正式判定由领域规则接入时处理。
import type { S17PracticeCenter } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

const FILES = import.meta.glob("../../../../../fixtures/pages/S17/*.json", { eager: true, import: "default" });
type Mode = S17PracticeCenter["availability"];

function center(ctx: MockContext, mode: Mode): S17PracticeCenter {
  const item = Object.entries(FILES).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`));
  if (item === undefined) throw new Error(`S17 缺少演示考试 ${ctx.exam.examId} 的页面数据`);
  const page = structuredClone(item[1]) as S17PracticeCenter;
  page.availability = mode;
  if (mode === "empty") {
    page.banks = [];
    page.questions = [];
    page.records = [];
  }
  if (mode === "restricted") page.ai.available = false;
  return page;
}

export const routes = [
  defineRoute("getPracticeCenter", (ctx) => center(ctx, "normal"), {
    variants: {
      empty: (ctx) => center(ctx, "empty"),
      restricted: (ctx) => center(ctx, "restricted"),
      insufficient_data: (ctx) => center(ctx, "insufficient_data"),
    },
  }),
];
