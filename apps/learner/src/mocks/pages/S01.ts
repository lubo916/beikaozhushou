// S01 欢迎与登录：只读演示上下文，业务数字直接来自本页 fixtures。
// feat:S01-02 年龄线待账号领域按适用规则提供，此处不写死法规年龄。
// feat:S01-13 游客数据合并计数来自假数据，不伪造登录、短信或正式账号写入。
import type { S01WelcomeData } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

const FILES = import.meta.glob("../../../../../fixtures/pages/S01/*.json", { eager: true, import: "default" });

/** 四个演示考试各有完整上下文；其他演示考试回落到首个上下文。 */
export function welcomeFixture(examId: string): S01WelcomeData {
  const hit = Object.entries(FILES).find(([path]) => path.endsWith(`/${examId}.json`));
  return structuredClone((hit?.[1] ?? Object.values(FILES)[0]) as S01WelcomeData);
}

function welcome(ctx: MockContext, availability: S01WelcomeData["availability"] = "ready"): S01WelcomeData {
  return { ...welcomeFixture(ctx.exam.examId), availability };
}

export const routes = [
  defineRoute("getWelcome", (ctx) => welcome(ctx), {
    variants: {
      empty: (ctx) => welcome(ctx, "empty"),
      restricted: (ctx) => welcome(ctx, "restricted"),
      insufficient_data: (ctx) => welcome(ctx, "insufficient_data"),
    },
  }),
];
