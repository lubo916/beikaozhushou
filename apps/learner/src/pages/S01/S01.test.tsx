// S01：生成契约、四考试假数据、接口强制状态与实际页面连接。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import { App } from "../../App.tsx";
import { mountAt, settle } from "../../app/testing.tsx";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { welcomeFixture } from "../../mocks/pages/S01.ts";
import { welcomeView, shouldRetry, type WelcomeQuery } from "./data.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";

type Json = Record<string, unknown>;
interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getWelcomeResponse"] as Parser | undefined;
const NOW = Date.parse("2026-10-22T10:00:00Z");

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const welcome = () =>
    api.handle({ method: "GET", url: "http://localhost/api/v1/account/welcome", headers: new Headers(), body: undefined });
  return { api, control, welcome };
}

describe("S01 契约与假数据", () => {
  it("正常、空、受限、数据不足四种上下文在四个演示考试都通过生成的 Zod", async () => {
    expect(typeof parser?.safeParse).toBe("function");
    const variants = { "": "ready", empty: "empty", restricted: "restricted", insufficient_data: "insufficient_data" } as const;
    for (const [state, expected] of Object.entries(variants)) {
      const { control, welcome } = setup(state);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const outcome = await welcome();
        expect(outcome.kind, `${exam.key}/${state}`).toBe("json");
        if (outcome.kind !== "json") throw new Error("没有取到欢迎数据");
        expect(outcome.status).toBe(200);
        const parsed = parser?.safeParse(outcome.body);
        expect(parsed?.success, `${exam.key}/${state}: ${String(parsed?.error)}`).toBe(true);
        const body = outcome.body as Json;
        expect(body["availability"]).toBe(expected);
        expect(body["data_source"]).toBe("sample");
        expect((body["age_options"] as Json[]).map((option) => option["eligibility"])).toEqual(["allowed", "minor", "blocked"]);
      }
    }
  });

  it("加载挂起、离线不回响应、出错回统一错误，不伪造成功数据", async () => {
    expect((await setup("loading").welcome()).kind).toBe("hang");
    expect((await setup("offline").welcome()).kind).toBe("network_error");
    const error = await setup("error").welcome();
    expect(error.kind === "json" && error.status).toBe(500);
  });
});

describe("S01 七态判断与重试", () => {
  const waiting: WelcomeQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): WelcomeQuery => ({ ...waiting, error, status: "error", fetchStatus: "idle" });

  it("未取到数据时区分加载、离线、受限和服务异常", () => {
    expect(welcomeView(waiting).state).toBe("loading");
    expect(welcomeView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(welcomeView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(welcomeView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(welcomeView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
  });

  it("服务给正常、空、受限、数据不足时原样映射，有离线旧数据时保留", () => {
    const fixture = welcomeFixture("junior-accounting");
    for (const availability of ["ready", "empty", "restricted", "insufficient_data"] as const) {
      const view = welcomeView({ ...waiting, status: "success", fetchStatus: "idle", data: { ...fixture, availability } });
      expect(view.state).toBe(availability === "ready" ? "normal" : availability);
      expect(view.stale).toBe(false);
    }
    const cached = welcomeView({ ...failed(new TypeError("Failed to fetch")), data: fixture });
    expect(cached.state).toBe("normal");
    expect(cached.data).toBe(fixture);
    expect(cached.stale).toBe(true);
  });

  it("网络或服务异常仅重试一次，4xx不重试", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
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

describe("S01 页面连接", () => {
  it("首次欢迎通过生成钩子读取假数据，年龄段无默认选择", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/welcome", <App />);
    try {
      await settle(() => host.querySelector('[role="radio"], input[type="radio"]') !== null);
      const checked = host.querySelectorAll('[role="radio"][aria-checked="true"], input[type="radio"]:checked');
      expect(checked.length).toBe(0);
      expect(host.querySelector('input[type="tel"]')).toBeNull();
      expect(host.querySelector('[data-mode="standalone"]')).not.toBeNull();
    } finally {
      await unmount();
    }
  });

  it("回访视图直接显示独立登录表单，协议和隐私分别不默认勾选", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/welcome?view=back", <App />);
    try {
      await settle(() => host.querySelector('input[type="tel"]') !== null);
      expect(host.querySelector('input[type="tel"]')).not.toBeNull();
      expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
      expect(host.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(0);
    } finally {
      await unmount();
    }
  });

  it("网络或服务错误显示公共出错态和重试入口", async () => {
    stubFetch(setup("error").api);
    const { host, unmount } = await mountAt("/welcome", <App />);
    try {
      await settle(() => host.querySelector(".ui-state--error") !== null, 250);
      const state = host.querySelector(".ui-state--error");
      expect(state?.getAttribute("role")).toBe("alert");
      expect(state?.querySelectorAll("button").length).toBeGreaterThanOrEqual(2);
    } finally {
      await unmount();
    }
  });
});
