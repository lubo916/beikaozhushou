// U13：假数据契约、请求状态映射及整页接通。
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
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
function stubFetch(api: MockApi, transform?: (data: S13ClassroomHome) => S13ClassroomHome): void {
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
    const body =
      transform !== undefined && result.status === 200 && new URL(url, "http://localhost").pathname === "/api/v1/learner/classroom"
        ? transform(result.body as S13ClassroomHome)
        : result.body;
    return new Response(JSON.stringify(body), { status: result.status, headers: { "content-type": "application/json" } });
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

describe("S13 课堂边界回归", () => {
  it("仅登记外部课程时仍显示正常课堂", async () => {
    const data = await setup().home();
    expect(data.external_courses.length).toBeGreaterThan(0);
    const query: ClassroomQuery = {
      data: { ...data, courses: [], notes: [] },
      error: null,
      status: "success",
      fetchStatus: "idle",
    };
    expect(classroomView(query).state).toBe("normal");
    stubFetch(setup().api, (response) => ({ ...response, courses: [], notes: [] }));
    const { host, unmount } = await mountAt("/classroom", <App />);
    try {
      await settle(() => linkByText(host, text("external.open")) !== undefined);
      expect(linkByText(host, text("external.open"))?.getAttribute("href")).toBe(data.external_courses[0]?.url);
    } finally {
      await unmount();
    }
  });

  it("接口返回的 AI 笔记在笔记条目内显示 AI 生成标识", async () => {
    const context = setup();
    const data = await context.home();
    const firstNote = data.notes[0];
    if (firstNote === undefined) throw new Error("示例缺少时间戳笔记");
    stubFetch(context.api, (response) => ({ ...response, notes: [{ ...firstNote, ai_generated: true }] }));
    const { host, unmount } = await mountAt("/classroom", <App />);
    try {
      await settle(() => [...host.querySelectorAll("article")].some((article) => article.textContent?.includes(firstNote.text)));
      const article = [...host.querySelectorAll("article")].find((item) => item.textContent?.includes(firstNote.text));
      expect(article, "AI 笔记应显示在时间戳笔记列表").toBeDefined();
      expect(article?.querySelector(".ui-ai"), "AI 笔记应使用带复制标记的公共 AiContent").toBeTruthy();
    } finally {
      await unmount();
    }
  });

  it("切换课程后只显示当前课程片段关联的时间戳笔记", async () => {
    const context = setup();
    const data = await context.home();
    const firstCourse = data.courses[0];
    const secondCourse = data.courses[1];
    const firstSegment = firstCourse?.segments[0];
    if (firstCourse === undefined || secondCourse === undefined || firstSegment === undefined) throw new Error("示例缺少两门课程");
    // 真实不同课程的片段具有独立 ID；避免演示 fixture 复用片段 ID 掩盖跨课笔记混入。
    const secondSegments = secondCourse.segments.map((segment) => ({ ...segment, id: crypto.randomUUID() }));
    const secondSegment = secondSegments[0];
    if (secondSegment === undefined) throw new Error("第二门课程缺少片段");
    const second = { ...secondCourse, segments: secondSegments, current_segment_id: secondSegment.id };
    const firstNote = {
      id: crypto.randomUUID(),
      segment_id: firstSegment.id,
      at_seconds: firstSegment.start_seconds,
      text: "第一门课的专属笔记",
      ai_generated: false,
    };
    const secondNote = {
      id: crypto.randomUUID(),
      segment_id: secondSegment.id,
      at_seconds: secondSegment.start_seconds,
      text: "第二门课的专属笔记",
      ai_generated: false,
    };
    stubFetch(context.api, (response) => ({ ...response, courses: [firstCourse, second], notes: [firstNote, secondNote] }));
    const { host, unmount } = await mountAt("/classroom", <App />);
    try {
      await settle(() => host.querySelector("main#main select") !== null);
      const select = host.querySelector<HTMLSelectElement>("main#main select");
      if (select === null) throw new Error("缺少课程选择器");
      await act(async () => {
        select.value = second.id;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await settle(() => [...host.querySelectorAll("article")].some((article) => article.textContent?.includes(secondNote.text)));
      const notes = [...host.querySelectorAll("main#main article")].map((article) => article.textContent).join("\n");
      expect(notes).toContain(secondNote.text);
      expect(notes, "别的课程笔记不应混进当前课程").not.toContain(firstNote.text);
    } finally {
      await unmount();
    }
  });
});
