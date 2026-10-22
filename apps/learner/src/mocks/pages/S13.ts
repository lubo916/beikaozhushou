// S13 简版：所有业务数字来自页面示例；不生成学习证据，不伪装真实播放或保存。
import type { S13ClassroomHome } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

const FILES = import.meta.glob("../../../../../fixtures/pages/S13/*.json", { eager: true, import: "default" });
function home(ctx: MockContext): S13ClassroomHome {
  const hit = Object.entries(FILES).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`));
  if (hit === undefined) throw new Error("当前演示考试缺少课堂示例");
  return structuredClone(hit[1]) as S13ClassroomHome;
}
export const routes = [
  defineRoute("getClassroomHome", home, {
    variants: {
      empty: (ctx) => ({ ...home(ctx), courses: [], notes: [], external_courses: [] }),
      // 限制只发生在外部播放，页面其他内容仍可使用；默认 403 不在此覆盖。
      insufficient_data: (ctx) => ({ ...home(ctx), audio_available: false }),
    },
  }),
];
