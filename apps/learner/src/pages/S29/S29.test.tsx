// S29：契约验证、检索行为、状态映射与真实页面数据链路。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import type { S29SearchPage } from "@exam-prep/contract";
import * as zodSchemas from "@exam-prep/contract/zod";
import { App } from "../../App.tsx";
import { heading, linkByText, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S29.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { searchView, shouldRetry, type SearchQuery } from "./data.ts";
import { pathTo } from "../../routes.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
interface PageFixture {
  sample_query: string;
  aliases: string[];
  point_id: string;
  quick_tables: { id: string }[];
}
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getSearchPageResponse"] as Parser | undefined;
const pages = import.meta.glob<PageFixture>("../../../../../fixtures/pages/S29/*.json", { eager: true, import: "default" });
const NOW = Date.parse("2026-10-22T02:00:00Z");
const MODES = ["", "empty", "restricted", "insufficient_data"] as const;
function fixtureOf(examId: string): PageFixture {
  const fixture = Object.entries(pages).find(([path]) => path.endsWith(`/${examId}.json`))?.[1];
  if (fixture === undefined) throw new Error(`S29 fixture missing: ${examId}`);
  return fixture;
}
function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  async function search(params: Record<string, string> = {}): Promise<S29SearchPage> {
    const outcome = await api.handle({
      method: "GET",
      url: `http://localhost/api/v1/learner/search?${new URLSearchParams(params)}`,
      headers: new Headers(),
      body: undefined,
    });
    expect(outcome.kind).toBe("json");
    if (outcome.kind !== "json") throw new Error("Search response was not JSON");
    expect(outcome.status).toBe(200);
    const parsed = parser?.safeParse(outcome.body);
    expect(parsed?.success, String(parsed?.error)).toBe(true);
    return outcome.body as S29SearchPage;
  }
  return { api, control, search };
}

describe("S29 假数据契约与检索", () => {
  it("四个演示考试的四种数据变体都通过生成的 Zod，并保持各自的知识点和表格", async () => {
    expect(typeof parser?.safeParse).toBe("function");
    for (const mode of MODES) {
      const { control, search } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await search();
        expect(data.data_source).toBe("sample");
        expect(data.state_hint).toBe(mode === "" ? "normal" : mode);
        expect(data.recent.some((item) => item.kind === "point" && item.target_id === fixtureOf(exam.examId).point_id)).toBe(true);
        if (mode === "restricted") expect(data.photo_available).toBe(false);
        if (mode === "empty" || mode === "insufficient_data") expect(data.groups).toEqual([]);
      }
    }
  });

  it("拼音、模糊和自然语言示例可搜到同一知识点；空关键词与未知词给不同的出路", async () => {
    const { search } = setup();
    const fixture = fixtureOf(fixtures.exams[0]?.examId ?? "");
    for (const alias of fixture.aliases) {
      const data = await search({ q: alias });
      expect(data.state_hint).toBe("normal");
      expect(data.groups.find((group) => group.kind === "point")?.items[0]?.target_id).toBe(fixture.point_id);
    }
    expect((await search({ q: "  " })).state_hint).toBe("empty");
    const missing = await search({ q: "__no_s29_matching_content__" });
    expect(missing.state_hint).toBe("insufficient_data");
    expect(missing.groups).toEqual([]);
    expect(missing.quick_tables).toEqual([]);
  });

  it("类型筛选交给接口处理，速查选择有效时保留，不存在时回到可用表格", async () => {
    const { search } = setup();
    for (const kind of ["point", "material", "question", "note", "mistake", "tutor"]) {
      const data = await search({ kind });
      expect(data.groups.map((group) => group.kind)).toEqual([kind]);
      expect(data.groups[0]?.items.every((item) => item.kind === kind)).toBe(true);
    }
    const fixture = fixtureOf(fixtures.exams[0]?.examId ?? "");
    for (const table of fixture.quick_tables) expect((await search({ table: table.id })).selected_table).toBe(table.id);
    const fallback = await search({ table: "no-such-table" });
    expect(fallback.quick_tables.some((table) => table.id === fallback.selected_table)).toBe(true);
  });
});

describe("S29 七态与重试", () => {
  const pending: SearchQuery = { data: undefined, status: "pending", fetchStatus: "fetching", error: null };
  const failed = (error: unknown): SearchQuery => ({ data: undefined, status: "error", fetchStatus: "idle", error });
  it("加载、网络暂停、网络异常和接口错误各有正确状态", () => {
    expect(searchView(pending).state).toBe("loading");
    expect(searchView({ ...pending, fetchStatus: "paused" }).state).toBe("offline");
    expect(searchView(failed(new TypeError("network"))).state).toBe("offline");
    expect(searchView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(searchView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
  });
  it("成功响应的四种数据状态直接显示；缓存数据断网仍保留并标旧数据", async () => {
    for (const mode of MODES) {
      const data = await setup(mode).search();
      const result = searchView({ data, status: "success", fetchStatus: "idle", error: null });
      expect(result.state).toBe(data.state_hint);
      expect(result.data).toBe(data);
      expect(searchView({ data, status: "error", fetchStatus: "idle", error: new TypeError("network") })).toEqual({
        state: data.state_hint,
        data,
        stale: true,
      });
    }
  });
  it("只重试一次网络和服务错误，权限错误不重试", () => {
    expect(shouldRetry(0, new TypeError("network"))).toBe(true);
    expect(shouldRetry(1, new TypeError("network"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(1, new ApiError("COMMON_INTERNAL"))).toBe(false);
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
    if (outcome.kind !== "json") throw new TypeError("network");
    return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { "content-type": "application/json" } });
  });
}
afterEach(() => {
  vi.unstubAllGlobals();
});
describe("S29 页面真实数据链路", () => {
  it("生成钩子拿到分组结果、最近访问和速查表", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt(pathTo("S29"), <App />);
    try {
      await settle(() => host.querySelector(".s29-results section") !== null);
      expect(heading(host)).toBe(copy.title);
      expect(host.querySelectorAll(".s29-results section").length).toBe(6);
      expect(host.textContent).toContain(copy.recent.title);
      expect(host.textContent).toContain(copy.quick.title);
      expect(linkByText(host, copy.quick.point)?.getAttribute("href")).toBe(
        pathTo("S10", { kpId: fixtureOf("junior-accounting").point_id }),
      );
    } finally {
      await unmount();
    }
  });
  it("空态保留搜索框与最近访问；错误态给重试和反馈", async () => {
    for (const state of ["empty", "error"]) {
      stubFetch(setup(state).api);
      const { host, unmount } = await mountAt(pathTo("S29"), <App />);
      try {
        await settle(() => host.querySelector(`.ui-state--${state}`) !== null, 250);
        expect(heading(host)).toBe(copy.title);
        expect(host.querySelector('input[type="search"]')).not.toBeNull();
        expect(host.querySelector(`.ui-state--${state}`)?.textContent).toContain(
          state === "empty" ? copy.state.empty.title : copy.state.error.body,
        );
        if (state === "empty") expect(host.textContent).toContain(copy.recent.title);
        else expect(host.querySelectorAll(".ui-state--error button").length).toBe(2);
      } finally {
        await unmount();
      }
    }
  });
});
