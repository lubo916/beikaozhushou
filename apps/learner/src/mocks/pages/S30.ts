// S30 简版：只读演示上下文。进入房间、计时、举报与屏蔽尚未登记写权限，页面提示即将上线。
// 考试按请求里的 exam_id 取（查询键随之按考试分开）；没带时用开发工具条当前的演示考试，不认识的考试回 404。
// 番茄钟绑定的任务取该考试今日清单里真实存在的任务（S30-03：专注前选今日清单），任务名以清单为准。
import type { S30Room, S30StudyRoom } from "@exam-prep/contract";
import type { DemoExam } from "../demo.ts";
import { defineRoute, type MockContext } from "../route.ts";

interface PageFixture {
  readonly group_size: number;
  readonly rooms: readonly S30Room[];
  readonly focus: { readonly minutes: number; readonly today_minutes: number; readonly task_id: string };
}
type Mode = S30StudyRoom["page_state"];

const FILES = import.meta.glob<PageFixture>("../../../../../fixtures/pages/S30/*.json", { eager: true, import: "default" });

function examOf(ctx: MockContext): DemoExam {
  const examId = ctx.query.get("exam_id");
  return examId === null || examId === "" ? ctx.exam : ctx.db.examById(examId);
}

function studyRoom(ctx: MockContext, mode: Mode): S30StudyRoom {
  const exam = examOf(ctx);
  const fixture = Object.entries(FILES).find(([path]) => path.endsWith(`/${exam.examId}.json`))?.[1];
  if (fixture === undefined) throw new Error(`S30 缺少演示考试 ${exam.examId} 的页面数据`);
  const task = exam.learner.today_tasks.find((item) => item.id === fixture.focus.task_id);
  if (task === undefined) throw new Error(`S30 番茄钟绑定的任务不在 ${exam.examId} 的今日清单里`);
  return {
    page_state: mode,
    minor_mode: mode === "restricted",
    group_size: fixture.group_size,
    rooms: mode === "empty" ? [] : [...fixture.rooms],
    focus: { minutes: fixture.focus.minutes, today_minutes: fixture.focus.today_minutes, task: task.title },
    data_source: "sample",
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
