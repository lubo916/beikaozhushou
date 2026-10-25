// S31 会员与权益的示例数据。所有额度、金额文本、权益顺延与退款试算都来自 fixture，页面不做业务计算。
// 真实购买、续费关闭、兑换和退款尚未登记写权限，本任务只提供本人只读视图。
// feat:S31-01 feat:S31-03 feat:S31-05 feat:S31-06 feat:S31-08 feat:S31-10 feat:S31-11
// feat:S31-12 feat:S31-15 feat:S31-16 feat:S31-17 feat:S31-18 feat:S31-19 feat:S31-20 feat:S31-21 feat:S31-25
import type { S31Membership } from "@exam-prep/contract";
import { defineRoute } from "../route.ts";

type Mode = S31Membership["view_state"];

const FILES = import.meta.glob("../../../../../fixtures/pages/S31/*.json", { eager: true, import: "default" });

/** 每个演示考试有一份完整的会员页接口示例；返回副本，避免演示操作修改 fixture。 */
export function membershipFixture(examId: string, mode?: Mode): S31Membership {
  const hit = Object.entries(FILES).find(([path]) => path.endsWith(`/${examId}.json`));
  if (hit === undefined) throw new Error(`S31 缺少演示考试数据：${examId}`);
  const data = structuredClone(hit[1]) as S31Membership;
  if (mode !== undefined) data.view_state = mode;
  if (mode === "empty") data.orders = [];
  return data;
}

export const routes = [
  defineRoute("getS31Membership", (ctx) => membershipFixture(ctx.exam.examId), {
    variants: {
      empty: (ctx) => membershipFixture(ctx.exam.examId, "empty"),
      restricted: (ctx) => membershipFixture(ctx.exam.examId, "restricted"),
      insufficient_data: (ctx) => membershipFixture(ctx.exam.examId, "insufficient_data"),
    },
  }),
];
