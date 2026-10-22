import { describe, expect, it } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import * as schemas from "@exam-prep/contract/zod";
import type { S25Calendar } from "@exam-prep/contract";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { calendarView, shouldRetry, type CalendarQuery } from "./data.ts";

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (schemas as Record<string, unknown>)["getExamCalendarResponse"] as {
  safeParse(value: unknown): { success: boolean; error?: unknown };
};
async function sample(exam: string, state = ""): Promise<S25Calendar> {
  const control = new DevControl({
    examKeys: fixtures.exams.map((entry) => entry.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => `?exam=${exam}&state=${state}`,
    clock: () => Date.parse("2026-10-22T02:00:00Z"),
  });
  control.setExam(exam);
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const outcome = await api.handle({
    method: "GET",
    url: "http://localhost/api/v1/exam/calendar",
    headers: new Headers(),
    body: undefined,
  });
  expect(outcome.kind).toBe("json");
  if (outcome.kind !== "json") throw new Error("没有收到日历数据");
  expect(outcome.status).toBe(200);
  const parsed = parser.safeParse(outcome.body);
  expect(parsed.success, String(parsed.error)).toBe(true);
  return outcome.body as S25Calendar;
}
describe("S25 日历契约与七态", () => {
  it("四个演示考试与数据变体均符合生成的 Zod", async () => {
    for (const exam of fixtures.exams)
      for (const state of ["", "empty", "restricted", "insufficient_data"]) {
        const data = await sample(exam.key, state);
        expect(data.exam.exam_id).toBe(exam.examId);
        expect(data.target_date, "日历目标日应与当前备考目标一致").toBe(exam.learner.goal.target_date);
        expect(data.data_source).toBe("sample");
        expect(data.events.every((event) => event.status !== "estimated" || event.basis.length > 0)).toBe(true);
      }
  });
  it("数据不足不隐藏依据；空态没有节点；分科数据保留同日多场与分天", async () => {
    const data = await sample("kj", "insufficient_data");
    expect(data.events.every((event) => event.status === "estimated")).toBe(true);
    expect(data.sessions[0]?.date).toBe(data.sessions[1]?.date);
    expect(data.sessions[2]?.date).not.toBe(data.sessions[0]?.date);
    expect((await sample("kj", "empty")).events).toEqual([]);
  });
  it("七态由响应映射，旧数据断网仍保留并标记缓存", async () => {
    const pending: CalendarQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
    expect(calendarView(pending).state).toBe("loading");
    expect(calendarView({ ...pending, status: "error", error: new TypeError("offline") }).state).toBe("offline");
    expect(calendarView({ ...pending, status: "error", error: new ApiError("COMMON_INTERNAL") }).state).toBe("error");
    expect(calendarView({ ...pending, status: "error", error: new ApiError("COMMON_FORBIDDEN") }).state).toBe("restricted");
    for (const state of ["normal", "empty", "restricted", "insufficient_data"] as const) {
      const data = await sample("kj", state === "normal" ? "" : state);
      expect(calendarView({ ...pending, data, status: "success", fetchStatus: "idle" }).state).toBe(state);
    }
    const data = await sample("kj");
    expect(calendarView({ ...pending, data, status: "error", error: new TypeError("offline") })).toMatchObject({
      state: "normal",
      data,
      stale: true,
    });
  });
  it("网络或服务异常可再试一次，权限错误不重试", () => {
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(1, new ApiError("COMMON_INTERNAL"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});
