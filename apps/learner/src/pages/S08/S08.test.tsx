// S08：四考试、三周期、四数据变体的契约校验；状态映射与离线保护；页面正常、空与数据不足展示。
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { onlineManager } from "@tanstack/react-query";
import { ApiError } from "@exam-prep/contract/errors";
import type { S08Period, S08Report } from "@exam-prep/contract";
import * as zodSchemas from "@exam-prep/contract/zod";
import { formatScore } from "@exam-prep/shared/format";
import { App } from "../../App.tsx";
import { heading, linkByText, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S08.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { Reflection } from "./components/Reflection.tsx";
import { ReportData } from "./components/ReportData.tsx";
import { recapView, shouldRetry, type RecapQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { readonly success: boolean; readonly error?: unknown };
}
const parser = (zodSchemas as Record<string, unknown>)["getS08RecapResponse"] as Parser | undefined;
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const NOW = Date.parse("2026-10-21T02:00:00Z");
const PERIODS = ["week", "month", "round"] as const;
const MODES = ["", "empty", "restricted", "insufficient_data"] as const;

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const db = new MockDb(fixtures);
  const api = createMockApi({ db, control, routes });
  const report = async (period: S08Period): Promise<S08Report> => {
    const outcome = await api.handle({
      method: "GET",
      url: `http://localhost/api/v1/plan/recap/${period}`,
      headers: new Headers(),
      body: undefined,
    });
    expect(outcome.kind).toBe("json");
    if (outcome.kind !== "json") throw new Error("S08 数据没有返回 JSON");
    expect(outcome.status, JSON.stringify(outcome.body)).toBe(200);
    const result = parser?.safeParse(outcome.body);
    expect(result?.success, `${period}/${state}：${String(result?.error)}`).toBe(true);
    return outcome.body as S08Report;
  };
  return { control, api, report };
}

describe("S08 生成契约与假数据", () => {
  it("生成的 Zod 中存在本页响应校验器", () => {
    expect(typeof parser?.safeParse).toBe("function");
  });

  it("四个演示考试、三周期、正常与空/受限/不足四变体均通过生成的 Zod", async () => {
    for (const mode of MODES) {
      const { control, report } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        for (const period of PERIODS) {
          const data = await report(period);
          expect(data.exam_id).toBe(exam.examId);
          expect(data.view).toBe(period);
          expect(data.availability).toBe(mode === "" ? "ready" : mode);
          expect(data.data_source).toBe("sample");
        }
      }
    }
  });

  it("正常报告有固定结论、六档变化、五种学法，轮次额外带对比", async () => {
    const { report } = setup();
    for (const period of PERIODS) {
      const data = await report(period);
      expect(data.summary).not.toBe("");
      expect(data.highlights).toHaveLength(3);
      expect(data.improvement).not.toBe("");
      expect(data.mastery.map((row) => row.level)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(data.methods.map((method) => method.key)).toEqual(["read", "watch", "listen", "practice", "recite"]);
      expect(data.coach).not.toBe("");
      expect(data.sample_count).toBeGreaterThan(0);
      expect(data.choices.some((choice) => choice.ai_generated)).toBe(true);
      if (period === "round") expect(data.comparison.length).toBeGreaterThan(0);
    }
  });

  it("预测变化和提分来源允许下降，负值也通过生成契约", async () => {
    const data = structuredClone(await setup().report("week"));
    data.metrics.forecast_delta = -2.5;
    const source = data.score_sources[0];
    expect(source, "正常报告应有提分来源，才能覆盖下降情况").toBeDefined();
    if (source === undefined) throw new Error("正常报告没有提分来源");
    source.delta = -2.5;
    const result = parser?.safeParse(data);
    expect(result?.success, String(result?.error)).toBe(true);
  });

  it("受限保留数据，只收起点评与导师生成建议；不足样本不返回结论或预测", async () => {
    const normal = await setup().report("week");
    const restricted = await setup("restricted").report("week");
    expect(restricted.metrics).toEqual(normal.metrics);
    expect(restricted.mastery).toEqual(normal.mastery);
    expect(restricted.coach).toBe("");
    expect(restricted.choices.every((choice) => !choice.ai_generated)).toBe(true);
    const insufficient = await setup("insufficient_data").report("week");
    expect(insufficient.metrics.effective_minutes).toBeGreaterThan(0);
    expect(insufficient.metrics.effective_minutes).toBeLessThan(insufficient.minimum_minutes);
    expect(insufficient.sample_count).toBeGreaterThan(0);
    expect(insufficient.summary).toBe("");
    expect(insufficient.highlights).toEqual([]);
    expect(insufficient.improvement).toBe("");
    expect(insufficient.coach).toBe("");
    expect(insufficient.choices).toEqual([]);
    expect(insufficient.forecast_available).toBe(false);
    expect(insufficient.score_sources).toEqual([]);
    expect(insufficient.comparison).toEqual([]);
  });

  it("自建考试地图未通过体检，页面锁定预测并隐藏提分来源", async () => {
    const { control, report } = setup();
    control.setExam("ds");
    const data = await report("week");
    expect(data.forecast_available).toBe(false);
    const { host, unmount } = await mountAt("/recap", <ReportData data={data} />);
    try {
      expect(host.textContent).toContain(copy.forecast_locked);
      for (const source of data.score_sources) expect(host.textContent).not.toContain(source.action);
    } finally {
      await unmount();
    }
  });
});

describe("S08 请求状态判断与重试", () => {
  const waiting: RecapQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };

  it("未收到数据时分别映射加载、离线与接口出错", () => {
    expect(recapView(waiting).state).toBe("loading");
    expect(recapView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(recapView({ ...waiting, status: "error", fetchStatus: "idle", error: new TypeError("Failed to fetch") }).state).toBe("offline");
    expect(recapView({ ...waiting, status: "error", fetchStatus: "idle", error: new ApiError("COMMON_INTERNAL") }).state).toBe("error");
  });

  it("有缓存报告时断网保留原对象，并标记离线供写操作禁用", async () => {
    const data = await setup().report("week");
    for (const query of [
      { data, error: new TypeError("Failed to fetch"), status: "error", fetchStatus: "idle" },
      { data, error: null, status: "success", fetchStatus: "paused" },
    ] as const) {
      const view = recapView(query);
      expect(view.data).toBe(data);
      expect(view.state).toBe("ready");
      expect(view.offline).toBe(true);
    }
  });

  it("缓存可用时保留空、受限和不足态；服务异常与断网分别处理", async () => {
    for (const state of ["empty", "restricted", "insufficient_data"] as const) {
      const data = await setup(state).report("week");
      expect(recapView({ data, error: null, status: "success", fetchStatus: "idle" }).state).toBe(state);
    }
    const data = await setup().report("week");
    expect(recapView({ data, error: new ApiError("COMMON_INTERNAL"), status: "error", fetchStatus: "idle" }).offline).toBe(false);
  });

  it("网络/服务异常仅重试一次，4xx 不重试", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
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

describe("S08 页面与离线写入保护", () => {
  it("负预测变化在统计数和提分来源中保留负号，不显示正负号拼接", async () => {
    const data = structuredClone(await setup().report("week"));
    data.metrics.forecast_delta = -2.5;
    const source = data.score_sources[0];
    expect(source).toBeDefined();
    if (source === undefined) throw new Error("正常报告没有提分来源");
    source.delta = -2.5;
    const expected = formatScore(-2.5);
    const { host, unmount } = await mountAt("/recap", <ReportData data={data} />);
    try {
      expect(host.textContent).toContain(expected);
      expect(host.textContent).not.toContain("+-2.5");
      const forecastStat = [...host.querySelectorAll(".ui-stat")].find(
        (stat) => stat.querySelector(".ui-stat__label")?.textContent === copy.metrics.forecast_delta,
      );
      expect(forecastStat?.querySelector(".ui-stat__value")?.textContent?.trim()).toBe(expected);
      const sourceValue = [...host.querySelectorAll("li strong")].find((node) => node.closest("li")?.textContent?.includes(source.module));
      expect(sourceValue?.textContent?.trim()).toBe(expected);
      const negativeValues = [...host.querySelectorAll(".ui-stat__value, li strong")].filter(
        (node) => node.textContent?.trim() === expected,
      );
      expect(negativeValues.length).toBeGreaterThanOrEqual(2);
    } finally {
      await unmount();
    }
  });

  it("正常报告标题、数据区、教练与唯一决定区都能显示", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/recap", <App />);
    try {
      await settle(() => host.querySelector('[data-testid="s08-data"]') !== null);
      expect(heading(host)).toBe(copy.title);
      for (const title of [copy.sections.summary, copy.sections.mastery, copy.sections.coach, copy.sections.decision])
        expect(host.textContent).toContain(title);
      expect(host.querySelectorAll('input[name="s08-change"]:checked')).toHaveLength(0);
    } finally {
      await unmount();
    }
  });

  it("空态保留页头，并给去今日学习的入口", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt("/recap", <App />);
    try {
      await settle(() => host.querySelector(".ui-state--empty") !== null);
      expect(heading(host)).toBe(copy.title);
      const empty = host.querySelector(".ui-state--empty");
      expect(empty?.textContent).toContain(copy.state.empty.title);
      expect(linkByText(empty, copy.state.empty.action)?.getAttribute("href")).toBe("/today");
    } finally {
      await unmount();
    }
  });

  it("服务异常显示规范出错说明与重试", async () => {
    stubFetch(setup("error").api);
    const { host, unmount } = await mountAt("/recap", <App />);
    try {
      await settle(() => host.querySelector(".ui-state--error") !== null, 250);
      const error = host.querySelector(".ui-state--error");
      expect(error?.textContent).toContain(copy.state.error.body);
      const buttons = [...(error?.querySelectorAll("button") ?? [])];
      expect(buttons.some((button) => button.textContent?.trim() === copy.retry)).toBe(true);
    } finally {
      await unmount();
    }
  });

  it("数据不足只展示原始记录，不给总结、效率结论或计划提议", async () => {
    stubFetch(setup("insufficient_data").api);
    const { host, unmount } = await mountAt("/recap", <App />);
    try {
      await settle(() => host.querySelector(".ui-state--insufficient_data") !== null);
      expect(host.textContent).toContain(copy.raw_only);
      expect(host.textContent).toContain(copy.metrics.effective_minutes);
      expect(host.textContent).not.toContain(copy.sections.highlights);
      expect(host.querySelectorAll('input[name="s08-change"]')).toHaveLength(0);
      expect(host.querySelector(".ui-proposal")).toBeNull();
    } finally {
      await unmount();
    }
  });

  it("已加载报告后直接断网，报告保留且写入与单选立即禁用", async () => {
    onlineManager.setOnline(true);
    stubFetch(setup().api);
    const { host, unmount } = await mountAt("/recap", <App />);
    try {
      await settle(() => host.querySelector('[data-testid="s08-data"]') !== null);
      const reportBefore = host.querySelector('[data-testid="s08-data"]')?.textContent;
      expect(reportBefore).toBeDefined();
      expect(reportBefore).toContain(copy.metrics.effective_minutes);
      const radioBefore = host.querySelector<HTMLInputElement>('input[name="s08-change"]');
      expect(radioBefore?.matches(":disabled")).toBe(false);
      await act(async () => {
        onlineManager.setOnline(false);
      });
      await settle(() => host.querySelector('input[name="s08-change"]')?.matches(":disabled") === true);
      expect(host.querySelector('[data-testid="s08-data"]')?.textContent).toBe(reportBefore);
      expect(host.textContent).toContain(copy.decision.offline);
      const radios = [...host.querySelectorAll<HTMLInputElement>('input[name="s08-change"]')];
      expect(radios.length).toBeGreaterThan(0);
      expect(radios.every((input) => input.matches(":disabled"))).toBe(true);
      const buttons = [...host.querySelectorAll<HTMLButtonElement>("button")];
      for (const label of [copy.decision.confirm, copy.questions.save, copy.feedback.yes, copy.feedback.no]) {
        const button = buttons.find((item) => item.textContent?.trim() === label);
        expect(button, label).toBeDefined();
        expect(button?.disabled, label).toBe(true);
      }
    } finally {
      await act(async () => {
        onlineManager.setOnline(true);
      });
      await unmount();
    }
  });

  it("离线缓存报告可读，单选、保存和反馈均禁用", async () => {
    const data = await setup().report("week");
    const { host, unmount } = await mountAt("/recap", <Reflection data={data} offline />);
    try {
      expect(host.textContent).toContain(data.coach);
      expect(host.textContent).toContain(copy.decision.offline);
      const radios = [...host.querySelectorAll<HTMLInputElement>('input[name="s08-change"]')];
      expect(radios.length).toBeGreaterThan(0);
      expect(radios.every((input) => input.matches(":disabled"))).toBe(true);
      const buttons = [...host.querySelectorAll<HTMLButtonElement>("button")];
      for (const label of [copy.decision.confirm, copy.questions.save, copy.feedback.yes, copy.feedback.no]) {
        const button = buttons.find((item) => item.textContent?.trim() === label);
        expect(button, label).toBeDefined();
        expect(button?.disabled, label).toBe(true);
      }
    } finally {
      await unmount();
    }
  });
});
