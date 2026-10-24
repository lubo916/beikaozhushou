import { afterEach, describe, expect, it, vi } from "vitest";
import type { S20Workspace } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import * as schemas from "@exam-prep/contract/zod";
import { App } from "../../App.tsx";
import { heading, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S20.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { gradingView, shouldRetry, type GradingQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (schemas as Record<string, unknown>)["getGradingWorkspaceResponse"] as Parser | undefined;
function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => Date.parse("2026-10-22T02:00:00Z"),
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const home = async (): Promise<S20Workspace> => {
    const outcome = await api.handle({
      method: "GET",
      url: "http://localhost/api/v1/grading/workspace",
      headers: new Headers(),
      body: undefined,
    });
    expect(outcome.kind).toBe("json");
    if (outcome.kind !== "json") throw new Error("未返回页面数据");
    expect(outcome.status).toBe(200);
    const parsed = parser?.safeParse(outcome.body);
    expect(parsed?.success, String(parsed?.error)).toBe(true);
    return outcome.body as S20Workspace;
  };
  return { api, control, home };
}

describe("S20 假数据契约与评分边界", () => {
  it("四考试的正常、空、受限、数据不足均通过生成 Zod，批注对应原文", async () => {
    expect(typeof parser?.safeParse).toBe("function");
    for (const mode of ["", "empty", "restricted", "insufficient_data"]) {
      const { control, home } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await home();
        expect(data.exam_id).toBe(exam.examId);
        expect(data.data_source).toBe("sample");
        if (mode === "empty") {
          expect(data.submission).toBeNull();
          expect(data.points).toEqual([]);
          expect(data.annotations).toEqual([]);
          expect(data.score).toBeNull();
        } else {
          expect(data.submission).not.toBeNull();
          expect(data.points.map((item) => item.status)).toEqual(["hit", "partial", "missed"]);
          for (const item of data.annotations) expect(data.submission?.original).toContain(item.quote);
        }
        if (mode === "restricted") {
          expect(data.availability).toBe("restricted");
          expect(data.score).toBeNull();
        }
        if (mode === "insufficient_data") {
          expect(data.rubric.available).toBe(false);
          expect(data.availability).toBe("insufficient_data");
          expect(data.score).toBeNull();
        }
        if (!data.rubric.consistent) expect(data.score).toBeNull();
      }
    }
  });
});

describe("S20 请求状态和重试", () => {
  const waiting: GradingQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): GradingQuery => ({ ...waiting, status: "error", fetchStatus: "idle", error });
  it("区分加载、离线、接口异常", () => {
    expect(gradingView(waiting).state).toBe("loading");
    expect(gradingView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(gradingView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(gradingView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
  });
  it("空态全页提示；受限和不足保留正文；缓存离线显示旧数据", async () => {
    for (const mode of ["", "empty", "restricted", "insufficient_data"]) {
      const data = await setup(mode).home();
      expect(gradingView({ ...waiting, data, status: "success", fetchStatus: "idle" }).state).toBe(mode === "empty" ? "empty" : "normal");
    }
    const data = await setup().home();
    const result = gradingView({ ...failed(new TypeError("Failed to fetch")), data });
    expect(result.state).toBe("normal");
    expect(result.data).toBe(data);
    expect(result.stale).toBe(true);
  });
  it("网络和服务异常重试一次；4xx 不重试", () => {
    for (const error of [new TypeError("Failed to fetch"), new ApiError("COMMON_INTERNAL")]) {
      expect(shouldRetry(0, error)).toBe(true);
      expect(shouldRetry(1, error)).toBe(false);
    }
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_NOT_FOUND"))).toBe(false);
  });
});

function stubFetch(api: MockApi) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const outcome = await api.handle({
      method: init?.method ?? "GET",
      url: new URL(url, "http://localhost").href,
      headers: new Headers(init?.headers),
      body: undefined,
    });
    if (outcome.kind === "hang") return new Promise<Response>(() => undefined);
    if (outcome.kind !== "json") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { "content-type": "application/json" } });
  });
}
afterEach(() => vi.unstubAllGlobals());
describe("S20 页面", () => {
  it("正常显示原文、批注、得分点与分数区间", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/grading", <App />);
    try {
      await settle(() => host.querySelector('[data-testid="s20-score"]') !== null);
      expect(heading(host)).toBe(copy.title);
      for (const title of [copy.question.title, copy.annotation.title, copy.points.title, copy.method.title, copy.rubric.title])
        expect(host.textContent).toContain(title);
      expect(host.querySelectorAll("blockquote").length).toBeGreaterThan(0);
      expect(host.querySelector('[data-testid="s20-score"]')).not.toBeNull();
    } finally {
      await unmount();
    }
  });
  it("低一致性只给要点，不显示分数区间", async () => {
    const { api, control } = setup();
    control.setExam("ds");
    stubFetch(api);
    const { host, unmount } = await mountAt("/grading?exam=ds", <App />);
    try {
      await settle(() => host.textContent?.includes(copy.score.inconsistent) === true);
      expect(host.textContent).toContain(copy.score.inconsistent);
      expect(host.querySelector('[data-testid="s20-score"]')).toBeNull();
      expect(host.querySelectorAll("blockquote").length).toBeGreaterThan(0);
    } finally {
      await unmount();
    }
  });
  it("空态保留页头与提交入口", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt("/grading?state=empty", <App />);
    try {
      await settle(() => host.querySelector(".ui-state--empty") !== null);
      expect(heading(host)).toBe(copy.title);
      expect(host.querySelector(".ui-state--empty")?.textContent).toContain(copy.state.empty.body);
      expect([...host.querySelectorAll("button")].some((button) => button.textContent === copy.submit)).toBe(true);
    } finally {
      await unmount();
    }
  });
});
