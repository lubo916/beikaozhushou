// U13：假数据契约、请求状态映射及整页接通。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import * as zodSchemas from "@exam-prep/contract/zod";
import type { S13ClassroomHome } from "@exam-prep/contract";
import { App } from "../../App.tsx";
import { heading, linkByText, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S13.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { classroomView, shouldRetry, type ClassroomQuery } from "./data.ts";
interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
type Json = Record<string, unknown>;
const parser = (zodSchemas as Record<string, unknown>)["getClassroomHomeResponse"] as Parser | undefined;
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
function text(path: string): string {
  let value: unknown = copy;
  for (const key of path.split(".")) value = typeof value === "object" && value !== null ? (value as Json)[key] : undefined;
  if (typeof value !== "string") throw new Error(`S13 文案缺少 ${path}`);
  return value;
}
function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => Date.parse("2026-10-22T10:00:00Z"),
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const home = async (): Promise<S13ClassroomHome> => {
    const result = await api.handle({
      method: "GET",
      url: "http://localhost/api/v1/learner/classroom",
      headers: new Headers(),
      body: undefined,
    });
    expect(result.kind).toBe("json");
    if (result.kind !== "json") throw new Error("课堂接口应返回 JSON");
    expect(result.status).toBe(200);
    const checked = parser?.safeParse(result.body);
    expect(checked?.success, String(checked?.error)).toBe(true);
    return result.body as S13ClassroomHome;
  };
  return { api, control, home };
}
describe("S13 假数据契约", () => {
  it("四考试的正常、空、音频数据不足均通过生成响应校验", async () => {
    expect(typeof parser?.safeParse).toBe("function");
    for (const state of ["", "empty", "insufficient_data"]) {
      const { control, home } = setup(state);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await home();
        expect(data.data_source).toBe("sample");
        if (state === "empty") {
          expect(data.courses).toEqual([]);
          expect(data.notes).toEqual([]);
          expect(data.external_courses).toEqual([]);
        } else {
          expect(data.courses.length).toBeGreaterThan(0);
          expect(data.courses.map((course) => course.source)).toEqual(["platform", "institution", "personal"]);
        }
        if (state === "insufficient_data") expect(data.audio_available).toBe(false);
      }
    }
  });
});
describe("S13 请求状态判断", () => {
  const waiting: ClassroomQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): ClassroomQuery => ({ ...waiting, status: "error", fetchStatus: "idle", error });
  it("加载、离线、受限和出错来自请求结果", () => {
    expect(classroomView(waiting).state).toBe("loading");
    expect(classroomView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(classroomView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(classroomView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(classroomView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
  });
  it("旧数据离线仍保留，空列表为空态，音频不足不阻断课程", async () => {
    const normal = await setup().home();
    const success: ClassroomQuery = { ...waiting, data: normal, status: "success", fetchStatus: "idle" };
    expect(classroomView(success).state).toBe("normal");
    expect(classroomView({ ...failed(new TypeError("Failed to fetch")), data: normal }).stale).toBe(true);
    expect(classroomView({ ...success, data: await setup("empty").home() }).state).toBe("empty");
    expect(classroomView({ ...success, data: await setup("insufficient_data").home() }).state).toBe("normal");
  });
  it("网络与服务异常仅重试一次，4xx 不重试", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});
function stubFetch(api: MockApi): void {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const result = await api.handle({
      method: init?.method ?? "GET",
      url: new URL(url, "http://localhost").href,
      headers: new Headers(init?.headers),
      body: undefined,
    });
    if (result.kind === "hang") return new Promise<Response>(() => undefined);
    if (result.kind !== "json") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(result.body), { status: result.status, headers: { "content-type": "application/json" } });
  });
}
afterEach(() => vi.unstubAllGlobals());
describe("S13 整页接通生成钩子与假数据", () => {
  it("正常显示课堂和片内检测入口", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/classroom", <App />);
    await settle(() => heading(host) === text("title"));
    expect(heading(host)).toBe(text("title"));
    await settle(() => linkByText(host, text("check.start")) !== undefined);
    expect(linkByText(host, text("check.start"))?.getAttribute("href")).toBe("/quiz/demo");
    await unmount();
  });
  it("空态保留页头并引导接入课程", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt("/classroom", <App />);
    await settle(() => host.querySelector(".ui-state--empty") !== null);
    expect(heading(host)).toBe(text("title"));
    expect(linkByText(host, text("state.empty.action"))?.getAttribute("href")).toBe("/materials");
    await unmount();
  });
  it("服务异常显示课堂出错态", async () => {
    stubFetch(setup("error").api);
    const { host, unmount } = await mountAt("/classroom", <App />);
    await settle(() => host.querySelector(".ui-state--error") !== null, 250);
    expect(host.querySelector(".ui-state--error")?.textContent).toContain(`${text("title")}没能加载`);
    await unmount();
  });
});
