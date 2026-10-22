// S34：fixture 契约、请求状态与真实挂载；业务规则仍由接口负责。
import { afterEach, describe, expect, it, vi } from "vitest";
import type { S34GrowthProfile } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import sample from "../../../../../fixtures/pages/S34/junior-accounting.json";
import { App } from "../../App.tsx";
import { heading, linkByText, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S34.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { growthView, shouldRetry, type GrowthQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const parser = (zodSchemas as Record<string, unknown>)["getGrowthProfileResponse"] as Parser;
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((e) => e.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => Date.parse("2026-10-22T10:00:00Z"),
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const profile = async () => {
    const result = await api.handle({
      method: "GET",
      url: "http://localhost/api/v1/account/growth",
      headers: new Headers(),
      body: undefined,
    });
    expect(result.kind).toBe("json");
    if (result.kind !== "json") throw new Error("档案没有返回 JSON");
    expect(result.status).toBe(200);
    const parsed = parser.safeParse(result.body);
    expect(parsed.success, String(parsed.error)).toBe(true);
    return result.body as S34GrowthProfile;
  };
  return { control, api, profile };
}

describe("S34 契约与四考试数据", () => {
  it("四个考试的正常、空、受限不适用、单次备考数据均通过生成 Zod", async () => {
    for (const mode of ["", "empty", "restricted", "insufficient_data"]) {
      const env = setup(mode);
      for (const exam of fixtures.exams) {
        env.control.setExam(exam.key);
        const data = await env.profile();
        expect(data.data_source).toBe("sample");
        expect(data.user).toEqual(fixtures.learner);
        if (mode === "") expect(data.goals[0]?.name).toBe(exam.profile.name);
        if (mode === "empty") expect([data.goals, data.history, data.milestones]).toEqual([[], [], []]);
        if (mode === "restricted") {
          expect(data.restriction_not_applicable).toBe(true);
          expect(data.goals.length).toBeGreaterThan(0);
        }
        if (mode === "insufficient_data") {
          expect(data.history).toHaveLength(1);
          expect(data.comparison).toEqual({ available: false, attempts: 1, items: [] });
          expect(data.abilities.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("S34 请求状态", () => {
  const waiting: GrowthQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): GrowthQuery => ({ ...waiting, status: "error", fetchStatus: "idle", error });
  it("区分加载、离线、出错与请求拒绝", () => {
    expect(growthView(waiting).state).toBe("loading");
    expect(growthView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(growthView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(growthView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(growthView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
  });
  it("有缓存离线时保留档案；空态只看接口列表", () => {
    const data = sample as S34GrowthProfile;
    expect(growthView({ ...failed(new TypeError("Failed to fetch")), data })).toEqual({ state: "normal", data, stale: true });
    expect(growthView({ ...waiting, status: "success", data: { ...data, goals: [], history: [] } }).state).toBe("empty");
  });
  it("仅网络与服务错误重试一次，4xx 不重试", () => {
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
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

describe("S34 页面", () => {
  it("正常显示 P1 卡片和新增目标入门入口", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/growth", <App />);
    await settle(() => host.textContent?.includes(copy.milestones.title) === true);
    expect(heading(host)).toBe(copy.title);
    for (const title of [copy.goals.title, copy.milestones.title, copy.abilities.title, copy.packages.title, copy.history.title])
      expect(host.textContent).toContain(title);
    expect(linkByText(host, copy.goals.add)?.getAttribute("href")).toBe("/goals");
    await unmount();
  });
  it("空态保留页头并引导去今日", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt("/growth", <App />);
    await settle(() => host.querySelector(".ui-state--empty") !== null);
    expect(heading(host)).toBe(copy.title);
    expect(linkByText(host, copy.state.empty.action)?.getAttribute("href")).toBe("/today");
    await unmount();
  });
  it("错误可重试与反馈", async () => {
    stubFetch(setup("error").api);
    const { host, unmount } = await mountAt("/growth", <App />);
    await settle(() => host.querySelector(".ui-state--error") !== null, 250);
    expect(host.querySelector(".ui-state--error")?.textContent).toContain(copy.title);
    expect(host.querySelectorAll(".ui-state--error button")).toHaveLength(2);
    await unmount();
  });
});
