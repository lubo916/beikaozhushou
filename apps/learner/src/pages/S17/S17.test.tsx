// S17：四个演示考试的契约假数据、七态判断与真实生成钩子的页面接线。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import { VOCAB } from "@exam-prep/shared/vocab";
import * as zodSchemas from "@exam-prep/contract/zod";
import type { S17PracticeCenter } from "@exam-prep/contract";
import { App } from "../../App.tsx";
import copy from "../../i18n/zh-CN/S17.json";
import { heading, mountAt, settle } from "../../app/testing.tsx";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { practiceView, shouldRetry, type PracticeQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getPracticeCenterResponse"] as Parser | undefined;
const MODES = ["", "empty", "restricted", "insufficient_data"] as const;

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => Date.parse("2026-10-22T02:00:00Z"),
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const center = async (): Promise<S17PracticeCenter> => {
    const outcome = await api.handle({
      method: "GET",
      url: "http://localhost/api/v1/practice/center",
      headers: new Headers(),
      body: undefined,
    });
    expect(outcome.kind).toBe("json");
    if (outcome.kind !== "json") throw new Error("练习中心没有返回 JSON");
    expect(outcome.status).toBe(200);
    const result = parser?.safeParse(outcome.body);
    expect(result?.success, String(result?.error)).toBe(true);
    return outcome.body as S17PracticeCenter;
  };
  return { control, api, center };
}

describe("S17 假数据契约", () => {
  it("题目题型使用当前考试画像或统一词汇表的标签", async () => {
    const { control, center } = setup();
    for (const exam of fixtures.exams) {
      const types = exam.profile["question_types"] as readonly { readonly label: string }[];
      const allowed = new Set<string>([...Object.values(VOCAB.question_type), ...types.map((type) => type.label)]);
      control.setExam(exam.key);
      const data = await center();
      for (const question of data.questions) {
        expect(allowed.has(question.type_label), `${exam.key} 的题目 ${question.id} 题型标签应来自考试画像或统一词汇表`).toBe(true);
      }
    }
  });

  it("四个演示考试与四种数据态都通过生成的 Zod 校验", async () => {
    expect(typeof parser?.safeParse).toBe("function");
    for (const mode of MODES) {
      const { control, center } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await center();
        expect(data.exam_name.length).toBeGreaterThan(0);
        expect(data.data_source).toBe("sample");
        expect(data.availability).toBe(mode === "" ? "normal" : mode);
        if (mode === "empty") {
          expect(data.banks).toEqual([]);
          expect(data.questions).toEqual([]);
          expect(data.records).toEqual([]);
        } else {
          expect(data.banks.length).toBeGreaterThan(0);
          expect(data.questions.length).toBeGreaterThan(0);
          expect(data.recommendation.point_id).toBeTruthy();
          expect(data.recommendation.session_id).toBeTruthy();
        }
        if (mode === "restricted") expect(data.ai.available).toBe(false);
      }
    }
  });

  it("四个演示考试切换后返回不同的考试名和知识点", async () => {
    const { control, center } = setup();
    const names = new Set<string>();
    const points = new Set<string>();
    for (const exam of fixtures.exams) {
      control.setExam(exam.key);
      const data = await center();
      names.add(data.exam_name);
      points.add(data.recommendation.point_id);
    }
    expect(names.size).toBe(fixtures.exams.length);
    expect(points.size).toBe(fixtures.exams.length);
  });
});

describe("S17 七态判断", () => {
  const waiting: PracticeQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): PracticeQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });

  it("加载、网络离线、403受限与服务出错分别显示正确状态", () => {
    expect(practiceView(waiting).state).toBe("loading");
    expect(practiceView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(practiceView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(practiceView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(practiceView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
  });

  it("空态由接口数据决定；局部受限、数据不足不阻挡核心练习；旧数据离线仍保留", async () => {
    for (const mode of MODES) {
      const data = await setup(mode).center();
      const query: PracticeQuery = { data, error: null, status: "success", fetchStatus: "idle" };
      expect(practiceView(query).state).toBe(mode === "empty" ? "empty" : "normal");
      expect(practiceView({ ...query, fetchStatus: "paused" }).stale).toBe(true);
      expect(practiceView({ ...query, fetchStatus: "paused" }).data).toBe(data);
    }
  });

  it("网络或500只重试一次，4xx不重试", () => {
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

afterEach(() => vi.unstubAllGlobals());

describe("S17 页面接线", () => {
  it("正常态通过生成钩子显示接口推荐的题组", async () => {
    const mock = setup();
    const data = await mock.center();
    stubFetch(mock.api);
    const { host, unmount } = await mountAt("/practice", <App />);
    await settle(() => host.textContent?.includes(data.recommendation.title) === true);
    expect(heading(host)).toBe(copy.title);
    expect(host.textContent).toContain(data.recommendation.title);
    expect(host.textContent).toContain(data.recommendation.reason);
    await unmount();
  });

  it("空态仍保留页头与可操作的入口", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt("/practice", <App />);
    await settle(() => host.querySelector(".ui-state--empty") !== null);
    const empty = host.querySelector(".ui-state--empty");
    expect(heading(host)).toBe(copy.title);
    expect(empty?.querySelector("button, a")).not.toBeNull();
    await unmount();
  });

  it("服务出错自动重试后展示错误态和重试按钮", async () => {
    stubFetch(setup("error").api);
    const { host, unmount } = await mountAt("/practice", <App />);
    await settle(() => host.querySelector(".ui-state--error") !== null, 250);
    const error = host.querySelector(".ui-state--error");
    expect(error?.getAttribute("role")).toBe("alert");
    expect(error?.querySelector("button")).not.toBeNull();
    await unmount();
  });
});
