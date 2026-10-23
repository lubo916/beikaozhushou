// S16 简版回归：四考试与四种数据变体过契约；七态判断；口述限制与页面的正常、空、出错。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import type { S16Training } from "@exam-prep/contract";
import * as zodSchemas from "@exam-prep/contract/zod";
import { App } from "../../App.tsx";
import { heading, linkByText, mount, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S16.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { pathTo } from "../../routes.ts";
import { TrainingWorkspace } from "./components/TrainingWorkspace.tsx";
import { recitationView, shouldRetry, type RecitationQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getRecitationTrainingResponse"] as Parser | undefined;
const pageFixtures = import.meta.glob<S16Training>("../../../../../fixtures/pages/S16/*.json", { eager: true, import: "default" });
const NOW = Date.parse("2026-10-22T02:00:00Z");
const MODES = ["", "empty", "restricted", "insufficient_data"] as const;

function fixture(examId: string): S16Training {
  const value = Object.entries(pageFixtures).find(([path]) => path.endsWith(`/${examId}.json`))?.[1];
  if (value === undefined) throw new Error(`没有 ${examId} 的 S16 fixture`);
  return structuredClone(value);
}

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const request = () =>
    api.handle({
      method: "GET",
      url: "http://localhost/api/v1/content/recitation/training",
      headers: new Headers(),
      body: undefined,
    });
  const training = async (): Promise<S16Training> => {
    const result = await request();
    expect(result.kind).toBe("json");
    if (result.kind !== "json") throw new Error("背诵训练没有返回 JSON");
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    const parsed = parser?.safeParse(result.body);
    expect(parsed?.success, `?state=${state}：${String(parsed?.error)}`).toBe(true);
    return result.body as S16Training;
  };
  return { api, control, request, training };
}

describe("S16 契约与假数据", () => {
  it("生成了本页响应的 Zod 校验", () => {
    expect(typeof parser?.safeParse).toBe("function");
  });

  it("四个演示考试的正常、空、受限、样本不足数据都通过生成契约", async () => {
    for (const mode of MODES) {
      const { control, training } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await training();
        expect(data.exam_id).toBe(exam.examId);
        expect(data.data_source).toBe("sample");
        if (mode === "empty") expect(data.items).toEqual([]);
        else expect(data.items[0]?.title).toBe(fixture(exam.examId).items[0]?.title);
        if (mode === "restricted") expect(data.oral_available).toBe(false);
        if (mode === "insufficient_data") {
          expect(data.last_result.order).toBeUndefined();
          expect(data.last_result.oral_samples).toBeLessThan(data.order_min_samples);
        }
      }
    }
  });

  it("每个考试的两种来源、三级挖空与每个段落都有版本；导师内容带 AI 标记", () => {
    for (const exam of fixtures.exams) {
      const data = fixture(exam.examId);
      for (const item of data.items) {
        expect(item.segments.some((segment) => segment.id === data.default_segment)).toBe(true);
        expect(item.segments.some((segment) => segment.id === "all")).toBe(true);
        for (const segment of item.segments) {
          for (const level of ["keywords", "initials", "full"]) {
            for (const source of ["user", "tutor"]) {
              const matches = item.variants.filter(
                (entry) => entry.segment_id === segment.id && entry.level === level && entry.source === source,
              );
              expect(matches, `${exam.key}/${segment.id}/${source}/${level}`).toHaveLength(1);
              expect(matches[0]?.ai_generated).toBe(source === "tutor");
            }
          }
        }
      }
    }
  });

  it("加载、断网与服务错误由统一模拟层制造", async () => {
    expect((await setup("loading").request()).kind).toBe("hang");
    expect((await setup("offline").request()).kind).toBe("network_error");
    const error = await setup("error").request();
    expect(error.kind === "json" && error.status).toBe(500);
  });
});

describe("S16 请求状态与重试", () => {
  const waiting: RecitationQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): RecitationQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });
  const loaded = (data: S16Training): RecitationQuery => ({ data, error: null, status: "success", fetchStatus: "idle" });

  it("无数据时区分加载、查询暂停、网络错误、权限错误和服务错误", () => {
    expect(recitationView(waiting).state).toBe("loading");
    expect(recitationView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(recitationView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(recitationView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(recitationView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
  });

  it("按接口数据映射正常、空、受限与数据不足；离线保留已有内容", async () => {
    const expected = ["normal", "empty", "restricted", "insufficient_data"];
    for (const [index, mode] of MODES.entries()) {
      const data = await setup(mode).training();
      expect(recitationView(loaded(data)).state).toBe(expected[index]);
    }
    const data = fixture("junior-accounting");
    const stale = recitationView({ ...failed(new TypeError("Failed to fetch")), data });
    expect(stale).toMatchObject({ state: "normal", stale: true, data });
    expect(recitationView({ ...loaded(data), fetchStatus: "paused" }).stale).toBe(true);
  });

  it("网络与服务错误只重试一次，4xx 不重试", () => {
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("S16 页面", () => {
  it("正常态保留页头、训练内容和带历史示例说明的上次结果", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt(pathTo("S16"), <App />);
    await settle(() => host.querySelector('[data-testid="s16-workspace"]') !== null);
    expect(heading(host)).toBe(copy.title);
    expect(host.textContent).toContain(fixture("junior-accounting").items[0]?.title);
    expect(host.querySelector('[data-testid="s16-result"]')?.textContent).toContain(copy.last.hint);
    await unmount();
  });

  it("空态保留页头，并给出去阅读器的路由", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt(pathTo("S16"), <App />);
    await settle(() => host.querySelector(".ui-state--empty") !== null);
    expect(heading(host)).toBe(copy.title);
    expect(host.textContent).toContain(copy.state.empty.body);
    expect(linkByText(host, copy.state.empty.action)?.getAttribute("href")).toBe(pathTo("S12"));
    await unmount();
  });

  it("服务异常重试后显示准确出错文案和重试动作", async () => {
    stubFetch(setup("error").api);
    const { host, unmount } = await mountAt(pathTo("S16"), <App />);
    await settle(() => host.querySelector(".ui-state--error") !== null, 250);
    const error = host.querySelector(".ui-state--error");
    expect(error?.textContent).toContain(copy.state.error.title);
    expect(error?.textContent).toContain(copy.state.error.body);
    expect(error?.querySelectorAll("button").length).toBeGreaterThan(0);
    await unmount();
  });

  it("全文默写的空白提示即使只有换行，也显示先回忆再揭晓的引导", async () => {
    const data = fixture("junior-accounting");
    data.default_level = "full";
    const item = data.items[0];
    if (item === undefined) throw new Error("S16 缺少训练内容");
    const { host, unmount } = await mount(<TrainingWorkspace data={data} item={item} method="cloze" offline={false} />);
    expect(host.textContent).toContain(copy.recall);
    await unmount();
  });

  it("缓存内容离线仍可默写，但口述按钮与口述评分不可用", async () => {
    const data = fixture("junior-accounting");
    const item = data.items[0];
    if (item === undefined) throw new Error("S16 缺少训练内容");
    const { host, unmount } = await mount(<TrainingWorkspace data={data} item={item} method="oral" offline />);
    const buttons = [...host.querySelectorAll<HTMLButtonElement>("button")];
    expect(buttons.find((button) => button.textContent === copy.oral.start)?.disabled).toBe(true);
    expect(buttons.find((button) => button.textContent === copy.check)?.disabled).toBe(true);
    expect(host.querySelector("textarea")?.disabled).toBe(false);
    await unmount();
  });
});
