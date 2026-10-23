// S15 复习与卡片：GET 的页面数据只取本页四考试示例；未接评分、制卡与确认写操作。
// 加载、出错、离线由统一模拟层处理；其余异常态通过 variants 返回，不在组件中判断 URL。
// 所有量都是示例值，不在本页重做记忆算法；策略阈值一律经参数访问器读取。
import { param } from "@exam-prep/params";
import type { S15ReviewHome } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

type Mode = S15ReviewHome["state"];
const FILES = import.meta.glob("../../../../../fixtures/pages/S15/*.json", { eager: true, import: "default" });

function home(ctx: MockContext, state: Mode): S15ReviewHome {
  const file = Object.entries(FILES).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`));
  if (file === undefined) throw new Error(`S15 缺少演示数据：${ctx.exam.examId}`);
  const sample = structuredClone(file[1]) as S15ReviewHome;
  return {
    ...sample,
    state,
    exam_name: ctx.exam.profile.name,
    policy: {
      daily_cap: param("plan.review.daily_cap"),
      insufficient_threshold: param("learner.memory.min_cards_for_personal"),
      flip_guard_ms: param("learner.memory.min_rating_seconds") * 1000,
    },
    memory: { ...sample.memory, target_retention: param("learner.memory.target_retention") },
    ...(state === "empty" ? { queue: { ...sample.queue, due: 0, new_cards: 0, relearning: 0, minutes: 0 } } : {}),
  };
}

export const routes = [
  defineRoute("getReviewHome", (ctx) => home(ctx, "normal"), {
    variants: {
      empty: (ctx) => home(ctx, "empty"),
      restricted: (ctx) => home(ctx, "restricted"),
      insufficient_data: (ctx) => home(ctx, "insufficient_data"),
    },
  }),
];
