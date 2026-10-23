// S02 页面单元测试：四个演示考试与状态变体均须通过生成契约；
// 搜索保留目标与独立自建草稿，七态与重试仅由请求结果映射。
import { describe, expect, it } from "vitest";
import type { S02GoalsHome } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { routes } from "../../mocks/pages/S02.ts";
import { goalsView, searchRequestOptions, shouldRetry, type GoalsQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}

const fixtures = loadDemoFixtures();
const parser = (zodSchemas as Record<string, unknown>)["getS02GoalsResponse"] as Parser | undefined;
const MODES = ["normal", "empty", "restricted", "insufficient_data"] as const;
const NOW = Date.parse("2026-10-22T02:00:00Z");

function setup(state: (typeof MODES)[number] = "normal") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "normal" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const home = async (query = "", headers: Record<string, string> = {}): Promise<S02GoalsHome> => {
    const outcome = await api.handle({
      method: "GET",
      url: `http://localhost/api/v1/learner/goals/home${query}`,
      headers: new Headers(headers),
      body: undefined,
    });
    expect(outcome.kind).toBe("json");
    if (outcome.kind !== "json") throw new Error("本页接口没有返回 JSON");
    expect(outcome.status).toBe(200);
    const result = parser?.safeParse(outcome.body);
    expect(result?.success, String(result?.error)).toBe(true);
    return outcome.body as S02GoalsHome;
  };
  return { control, home };
}

describe("S02 假数据契约与候选筛选", () => {
  it("生成的响应校验器可用", () => {
    expect(typeof parser?.safeParse).toBe("function");
  });

  it("四个演示考试的正常、空、受限、数据不足数据均通过生成 Zod", async () => {
    for (const mode of MODES) {
      const { control, home } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await home();
        expect(data.availability).toBe(mode);
        expect(data.data_source).toBe("sample");
        expect(data.custom_choice.profile.kind).toBe("custom");
        expect(data.categories).not.toContain("全部");
        if (mode === "empty") expect(data.goals).toEqual([]);
        else expect(data.goals[0]?.exam_id).toBe(exam.examId);
        if (mode === "normal") expect(data.catalog[0]?.profile.exam_id).toBe(exam.examId);
        for (const goal of data.goals) {
          expect(goal.overlap).toBeGreaterThanOrEqual(0);
          expect(goal.overlap).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("全称、简称、俗称、拼音与自然语言均由接口给出候选", async () => {
    const { home } = setup();
    const terms = ["初级会计职称", "初级会计", "会计证", "chujikuaiji", "我想准备会计证"];
    for (const term of terms) {
      const data = await home(`?q=${encodeURIComponent(term)}`);
      expect(data.catalog.some((choice) => choice.profile.exam_id === "junior-accounting")).toBe(true);
    }
  });

  it("类别和搜索只筛选候选，不移除已建目标与手动自建画像", async () => {
    const { home } = setup();
    const unfiltered = await home();
    const filtered = await home(`?q=${encodeURIComponent("六级")}&category=${encodeURIComponent("语言学习")}`);
    expect(filtered.catalog.map((choice) => choice.profile.exam_id)).toEqual(["cet-6"]);
    expect(filtered.goals).toEqual(unfiltered.goals);
    expect(filtered.custom_choice).toEqual(unfiltered.custom_choice);
    const missing = await home("?q=not-an-exam");
    expect(missing.catalog).toEqual([]);
    expect(missing.templates).toEqual([]);
    expect(missing.custom_choice.profile.kind).toBe("custom");
  });

  it("数据不足时没有冒充官方库候选，仍可手动填写自建画像", async () => {
    const data = await setup("insufficient_data").home();
    expect(data.catalog).toEqual([]);
    expect(data.templates).toEqual([]);
    expect(data.custom_choice.profile.structure.length).toBeGreaterThan(0);
    expect(data.custom_choice.readiness).toBe("map_only");
  });
});

describe("S02 生成查询兼容头", () => {
  it("中文搜索与类别经请求选项编码，并由模拟层解码；清空头优先于旧查询", async () => {
    const { home } = setup();
    const request = searchRequestOptions("六级", "语言学习");
    expect(Object.values(request.headers).every((value) => Array.from(value).every((character) => character.charCodeAt(0) < 128))).toBe(
      true,
    );
    const filtered = await home("", request.headers);
    expect(filtered.catalog.map((choice) => choice.profile.exam_id)).toEqual(["cet-6"]);
    const cleared = await home("?q=missing&category=missing", searchRequestOptions("", "").headers);
    expect(cleared.catalog.length).toBe(fixtures.exams.length);
  });
});

describe("S02 请求状态与重试", () => {
  const waiting: GoalsQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): GoalsQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });

  it("pending 显示骨架；离线暂停和无网络回应显示离线", () => {
    expect(goalsView(waiting).state).toBe("loading");
    expect(goalsView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(goalsView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
  });

  it("403 显示受限；其他接口错误显示出错", () => {
    expect(goalsView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(goalsView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
    expect(goalsView(failed(new ApiError("COMMON_NOT_FOUND"))).state).toBe("error");
  });

  it("正常、空、受限、数据不足取接口状态，不从列表重新计算", async () => {
    for (const mode of MODES) {
      const data = await setup(mode).home();
      expect(goalsView({ data, error: null, status: "success", fetchStatus: "idle" })).toEqual({ state: mode, data, stale: false });
    }
  });

  it("已取到数据后断网，保留原内容并标记离线", async () => {
    const data = await setup().home();
    const view = goalsView({ data, error: new TypeError("Failed to fetch"), status: "error", fetchStatus: "idle" });
    expect(view).toEqual({ state: "normal", data, stale: true });
  });

  it("网络与服务异常只再试一次；4xx 不重试", () => {
    for (const error of [new TypeError("Failed to fetch"), new ApiError("COMMON_INTERNAL")]) {
      expect(shouldRetry(0, error)).toBe(true);
      expect(shouldRetry(1, error)).toBe(false);
    }
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_NOT_FOUND"))).toBe(false);
  });
});
