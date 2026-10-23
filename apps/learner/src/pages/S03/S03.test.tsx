// S03 契约示例、七态判断与生成钩子挂载验证。
import { afterEach, describe, expect, it, vi } from "vitest";
import type { S03SetupProfile } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import { COPY } from "@exam-prep/ui";
import { App } from "../../App.tsx";
import { heading, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S03.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { setupView, shouldRetry, type SetupQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getSetupProfileResponse"] as Parser | undefined;
const NOW = Date.parse("2026-10-22T02:00:00Z");
const MODES = ["normal", "empty", "restricted", "insufficient_data"] as const;

function setup(state = "normal") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "normal" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const profile = async (): Promise<S03SetupProfile> => {
    const outcome = await api.handle({
      method: "GET",
      url: "http://localhost/api/v1/learner/setup/profile",
      headers: new Headers(),
      body: undefined,
    });
    expect(outcome.kind).toBe("json");
    if (outcome.kind !== "json") throw new Error("S03 没有返回 JSON");
    expect(outcome.status).toBe(200);
    const result = parser?.safeParse(outcome.body);
    expect(result?.success, String(result?.error)).toBe(true);
    return outcome.body as S03SetupProfile;
  };
  return { api, control, profile };
}

describe("S03 假数据契约", () => {
  it("四个演示考试的正常、空、受限、数据不足响应全部通过生成的 Zod", async () => {
    expect(typeof parser?.safeParse).toBe("function");
    for (const state of MODES) {
      const { control, profile } = setup(state);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await profile();
        expect(data.exam_name).toBe(exam.profile.name);
        expect(data.state).toBe(state);
        expect(data.data_source).toBe("sample");
      }
    }
  });
  it("正常示例含三接入方式与六入口；空数据清空资料；样本不足不给实测结论", async () => {
    const normal = await setup().profile();
    expect(normal.materials.map((item) => item.access).sort()).toEqual(["link_only", "mapped_only", "parsable"]);
    expect(normal.import_methods.map((item) => item.id)).toEqual(["file", "photo", "drive", "link", "isbn", "template"]);
    const empty = await setup("empty").profile();
    expect([empty.materials, empty.maps, empty.unavailable_days]).toEqual([[], [], []]);
    const insufficient = await setup("insufficient_data").profile();
    expect(insufficient.calibration.status).toBe("collecting");
    expect(insufficient.calibration.observed_minutes).toBe(0);
  });
  it("周时间格、两行模板与接口周预算一致，预算差额与建议投入相符", async () => {
    const { control, profile } = setup();
    for (const exam of fixtures.exams) {
      control.setExam(exam.key);
      const data = await profile();
      const grid = data.days.flatMap((day) => day.slots).reduce((total, slot) => total + slot.minutes, 0);
      const weekday = data.templates.find((item) => item.id === "weekday");
      const weekend = data.templates.find((item) => item.id === "weekend");
      expect(grid).toBe(data.summary.weekly_minutes);
      expect((weekday?.minutes ?? 0) * 5 + (weekend?.minutes ?? 0) * 2).toBe(data.summary.weekly_minutes);
      expect(data.summary.recommended_hours - data.summary.total_hours).toBe(data.summary.gap_hours);
    }
  });
});

describe("S03 七态判断与重试", () => {
  const waiting: SetupQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): SetupQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });
  it("待请求显示加载；查询暂停或网络失败显示离线", () => {
    expect(setupView(waiting).state).toBe("loading");
    expect(setupView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(setupView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
  });
  it("权限错误显示受限，其余接口异常显示出错", () => {
    expect(setupView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(setupView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
  });
  it("有数据时尊重接口状态，离线保留旧数据并显示 stale", async () => {
    for (const state of MODES) {
      const data = await setup(state).profile();
      expect(setupView({ ...waiting, data, status: "success", fetchStatus: "idle" }).state).toBe(state);
      const cached = setupView({ ...failed(new TypeError("Failed to fetch")), data });
      expect(cached.data).toBe(data);
      expect(cached.state).toBe(state);
      expect(cached.stale).toBe(true);
    }
  });
  it("网络和服务异常只再试一次，4xx 不重试", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(1, new ApiError("COMMON_INTERNAL"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_NOT_FOUND"))).toBe(false);
  });
});

function stubFetch(api: MockApi): void {
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
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("S03 页面接入生成钩子", () => {
  it("时间和资料视图均展示各自的卡片与标题", async () => {
    stubFetch(setup().api);
    for (const [view, title, body] of [
      ["time", copy.time.title, copy.time.grid],
      ["res", copy.res.title, copy.res.list],
    ] as const) {
      const { host, unmount } = await mountAt(`/setup?view=${view}`, <App />);
      try {
        await settle(() => host.textContent?.includes(body) === true);
        expect(heading(host)).toBe(title);
        expect(host.textContent).toContain(body);
        expect(host.textContent).toContain(copy.sample);
      } finally {
        await unmount();
      }
    }
  });
  it("空态仍保留标题，并提供每日时长兜底按钮", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt("/setup?view=time", <App />);
    try {
      await settle(() => host.querySelector(".ui-state--empty") !== null);
      expect(heading(host)).toBe(copy.time.title);
      expect(host.querySelector(".ui-state--empty")?.textContent).toContain(copy.state.empty.title);
      expect([...host.querySelectorAll("button")].some((button) => button.textContent === copy.state.empty.action)).toBe(true);
    } finally {
      await unmount();
    }
  });
  it("服务异常显示统一错误标题与重试按钮", async () => {
    stubFetch(setup("error").api);
    const { host, unmount } = await mountAt("/setup?view=time", <App />);
    try {
      await settle(() => host.querySelector(".ui-state--error") !== null, 250);
      const error = host.querySelector(".ui-state--error");
      expect(error?.textContent).toContain(COPY.state.error.title.replace("{{page}}", copy.title));
      expect([...(error?.querySelectorAll("button") ?? [])].some((button) => button.textContent === COPY.action.retry)).toBe(true);
    } finally {
      await unmount();
    }
  });
});
