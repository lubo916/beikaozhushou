// S27：接口 fixture、七态判断与重试策略；端到端交互见 tests/e2e/pages/S27.spec.ts。
import { describe, expect, it } from "vitest";
import { act } from "react";
import type { S27SprintHome } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import { click, mountAt } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S27.json";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { shouldRetry, sprintView } from "./data.ts";
import { AfterView } from "./views/AfterView.tsx";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getS27SprintHomeResponse"] as Parser | undefined;
const NOW = Date.parse("2026-10-22T02:00:00Z");

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const home = async (): Promise<S27SprintHome> => {
    const outcome = await api.handle({
      method: "GET",
      url: "http://localhost/api/v1/learner/sprint",
      headers: new Headers(),
      body: undefined,
    });
    expect(outcome.kind).toBe("json");
    if (outcome.kind !== "json") throw new Error("冲刺接口没有返回页面数据");
    expect(outcome.status, JSON.stringify(outcome.body)).toBe(200);
    const parsed = parser?.safeParse(outcome.body);
    expect(parsed?.success, String(parsed?.error)).toBe(true);
    return outcome.body as S27SprintHome;
  };
  return { control, home };
}

describe("S27 假数据接口", () => {
  it("生成了本页响应的 Zod 校验器", () => {
    expect(typeof parser?.safeParse).toBe("function");
  });

  it("四个演示考试在正常、空、受限、数据不足时均符合契约，考试身份独立", async () => {
    for (const state of ["", "empty", "restricted", "insufficient_data"]) {
      const { control, home } = setup(state);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await home();
        expect(data.exam_id).toBe(exam.examId);
        expect(data.exam_name).toBe(exam.profile.name);
        expect(data.data_source).toBe("sample");
        if (state === "empty") expect(data.availability).toBe("not_yet");
        if (state === "restricted") expect(data.availability).toBe("exam_day");
        if (state === "insufficient_data") {
          expect(data.calibration_ready).toBe(false);
          expect(data.grades.every((grade) => grade.actual === undefined)).toBe(true);
        }
      }
    }
  });

  it("四个演示考试的估分合计与客观题、主观题区间一致", async () => {
    const { control, home } = setup();
    for (const exam of fixtures.exams) {
      control.setExam(exam.key);
      const data = await home();
      for (const estimate of data.estimates) {
        const context = `${exam.key}/${estimate.subject_key}`;
        // 只在测试里核对 fixture，页面仍直接展示接口返回的合计。
        expect(estimate.total_low, `${context} 估分下界`).toBeCloseTo(estimate.objective + estimate.subjective_low);
        expect(estimate.total_high, `${context} 估分上界`).toBeCloseTo(estimate.objective + estimate.subjective_high);
      }
    }
  });

  it("受限只表示考试当天静默，考务清单与一页纸仍由接口返回", async () => {
    const data = await setup("restricted").home();
    expect(data.availability).toBe("exam_day");
    expect(data.checklist.length).toBeGreaterThan(0);
    expect(data.sheet.item_keys.length).toBeGreaterThan(0);
    expect(data.sheet.ai_generated).toBe(true);
  });
});

describe("S27 七态与重试策略", () => {
  const waiting = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" } as const;
  const failure = (error: unknown) => ({ data: undefined, error, status: "error", fetchStatus: "idle" }) as const;

  it("等待显示加载；查询暂停与无响应显示离线；服务异常显示出错", () => {
    expect(sprintView(waiting).state).toBe("loading");
    expect(sprintView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(sprintView(failure(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(sprintView(failure(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
    expect(sprintView(failure(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
  });

  it("接口控制空态；静默和成绩不足保留正常页面供局部提示", async () => {
    for (const mode of ["", "empty", "restricted", "insufficient_data"]) {
      const data = await setup(mode).home();
      const view = sprintView({ data, error: null, status: "success", fetchStatus: "idle" });
      expect(view.state).toBe(mode === "empty" ? "empty" : "normal");
      expect(view.stale).toBe(false);
    }
  });

  it("有旧数据时断网保留正文并标记过期", async () => {
    const data = await setup().home();
    const view = sprintView({ data, error: new TypeError("Failed to fetch"), status: "error", fetchStatus: "idle" });
    expect(view.state).toBe("normal");
    expect(view.data).toBe(data);
    expect(view.stale).toBe(true);
  });

  it("网络或服务异常最多再试一次；4xx 不重试", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_NOT_FOUND"))).toBe(false);
  });
});

describe("S27 考后登记反馈", () => {
  it("提交成绩草稿后，提示在仍然打开的弹窗内可见且不改写接口成绩", async () => {
    const data = await setup().home();
    const originalGrades = structuredClone(data.grades);
    const { host, unmount } = await mountAt("/sprint?view=after", <AfterView data={data} soon={() => undefined} />);
    try {
      const register = [...host.querySelectorAll("button")].find((button) => button.textContent?.trim() === copy.after.grades.action);
      await click(register);
      const dialog = host.querySelector("dialog");
      expect(dialog?.open).toBe(true);
      const score = dialog?.querySelector<HTMLInputElement>('input[name="score"]');
      const form = dialog?.querySelector("form");
      if (score === null || score === undefined || form === null || form === undefined) throw new Error("成绩登记表单没有显示");
      score.value = "66";
      await act(async () => form.requestSubmit());
      expect(dialog?.open).toBe(true);
      expect(dialog?.querySelector('[role="status"]')?.textContent).toContain(copy.soon);
      expect(data.grades).toEqual(originalGrades);
    } finally {
      await unmount();
    }
  });
});
