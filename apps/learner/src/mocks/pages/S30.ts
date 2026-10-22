// S30 简版：只读演示上下文。进入房间、计时、举报与屏蔽尚未登记写权限，页面提示即将上线。
import type { S30StudyRoom } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

const FILES = import.meta.glob<S30StudyRoom>("../../../../../fixtures/pages/S30/*.json", { eager: true, import: "default" });
type Mode = S30StudyRoom["page_state"];

function studyRoom(ctx: MockContext, mode: Mode): S30StudyRoom {
  const fixture = Object.entries(FILES).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`))?.[1];
  if (fixture === undefined) throw new Error(`S30 缺少演示考试 ${ctx.exam.examId} 的页面数据`);
  return {
    ...fixture,
    page_state: mode,
    minor_mode: mode === "restricted",
    rooms: mode === "empty" ? [] : fixture.rooms,
  };
}

export const routes = [
  defineRoute("getS30StudyRoom", (ctx) => studyRoom(ctx, "normal"), {
    variants: {
      empty: (ctx) => studyRoom(ctx, "empty"),
      restricted: (ctx) => studyRoom(ctx, "restricted"),
      insufficient_data: (ctx) => studyRoom(ctx, "insufficient_data"),
    },
  }),
];
