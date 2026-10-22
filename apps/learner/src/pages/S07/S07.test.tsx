// S07 学习计划的浏览器测试：契约假数据、七态判断、视图与整页挂载。
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import type { S07PlanOverview } from "@exam-prep/contract";
import * as zodSchemas from "@exam-prep/contract/zod";
import { formatDays } from "@exam-prep/shared/format";
import { App } from "../../App.tsx";
import { click, heading, linkByText, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S07.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { planFixture } from "../../mocks/pages/S07.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { pathTo } from "../../routes.ts";
import { planView, readView, shouldRetry, VIEWS, type PlanQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getS07PlanOverviewResponse"] as Parser | undefined;
const NOW = Date.parse("2026-10-22T02:00:00Z");
const MODES = ["", "empty", "restricted", "insufficient_data"] as const;

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const overview = async (): Promise<S07PlanOverview> => {
    const outcome = await api.handle({
      method: "GET",
      url: "http://localhost/api/v1/learner/plan/overview",
      headers: new Headers(),
      body: undefined,
    });
    expect(outcome.kind).toBe("json");
    if (outcome.kind !== "json") throw new Error("学习计划接口没有返回 JSON");
    expect(outcome.status, JSON.stringify(outcome.body)).toBe(200);
    const parsed = parser?.safeParse(outcome.body);
    expect(parsed?.success, `?state=${state}：${String(parsed?.error)}`).toBe(true);
    return outcome.body as S07PlanOverview;
  };
  return { control, api, overview };
}

describe("S07 假数据与生成契约", () => {
  it("生成的 Zod 结构里有本页响应", () => {
    expect(typeof parser?.safeParse).toBe("function");
  });

  it("四个演示考试的正常、空、受限、数据不足响应均通过生成的 Zod 校验", async () => {
    for (const mode of MODES) {
      const { control, overview } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await overview();
        expect(data.plan.exam_id).toBe(exam.examId);
        expect(data.data_source).toBe("sample");
        expect(data.has_plan).toBe(mode !== "empty");
        if (mode === "restricted") expect(data.institution_locked).toBe(true);
        if (mode === "insufficient_data") expect(data.health_estimated).toBe(true);
      }
    }
  });

  it("每个考试使用自己的计划样例，返回独立副本，避免草稿污染下一次读取", () => {
    for (const exam of fixtures.exams) {
      const first = planFixture(exam.examId);
      const second = planFixture(exam.examId);
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(first.plan.exam_id).toBe(exam.examId);
      first.has_plan = false;
      expect(planFixture(exam.examId).has_plan).toBe(true);
    }
    expect(() => planFixture("missing-exam")).toThrow("S07 缺少演示考试");
  });

  // 回归：交接时四份样例的 scheduled_minutes 是 586，七天实际合计 486，预算与缓冲也随错误汇总而来。
  // 原型写的是“本周预算 9 小时，已排 8 小时 6 分，留 1 成缓冲”，即 540 / 486 / 54。页面只显示接口数字，样例自身必须先自洽。
  it("四个考试的本周预算样例自洽：已排等于七天合计，缓冲等于预算减已排", () => {
    for (const exam of fixtures.exams) {
      const { week } = planFixture(exam.examId);
      const where = `${exam.examId} 的本周样例`;
      expect(week.days, where).toHaveLength(7);
      const dayTotal = week.days.reduce((sum, day) => sum + day.minutes, 0);
      expect(week.scheduled_minutes, `${where}：已排应等于七天合计`).toBe(dayTotal);
      expect(week.buffer_minutes, `${where}：缓冲应等于预算减已排`).toBe(week.budget_minutes - week.scheduled_minutes);
      expect(week.scheduled_minutes, `${where}：已排不应超过预算`).toBeLessThanOrEqual(week.budget_minutes);
      for (const day of week.days) {
        const itemTotal = day.items.reduce((sum, item) => sum + item.minutes, 0);
        expect(day.minutes, `${where}：${day.day} 当天合计应等于当天任务之和`).toBe(itemTotal);
      }
    }
  });

  it("四个考试的本周样例与原型一致：预算 540、已排 486、缓冲 54", () => {
    for (const exam of fixtures.exams) {
      const { week } = planFixture(exam.examId);
      const where = `${exam.examId} 的本周样例`;
      expect(week.budget_minutes, `${where}：预算 9 小时`).toBe(540);
      expect(week.scheduled_minutes, `${where}：已排 8 小时 6 分`).toBe(486);
      expect(week.buffer_minutes, `${where}：留 1 成缓冲`).toBe(54);
      expect(
        week.days.map((day) => day.minutes),
        `${where}：每日分钟数`,
      ).toEqual([46, 56, 20, 46, 53, 120, 145]);
    }
  });

  it("空态保留上下文；受限和数据不足只改标记，不清除计划或学习范围", async () => {
    const normal = await setup().overview();
    const empty = await setup("empty").overview();
    expect(empty.plan).toEqual(normal.plan);
    expect(empty.has_plan).toBe(false);
    const restricted = await setup("restricted").overview();
    expect(restricted.institution_locked).toBe(true);
    expect(restricted.scope).toEqual(normal.scope);
    expect(restricted.rounds).toEqual(normal.rounds);
    const insufficient = await setup("insufficient_data").overview();
    expect(insufficient.health_estimated).toBe(true);
    expect(insufficient.week).toEqual(normal.week);
    expect(insufficient.today).toEqual(normal.today);
  });
});

describe("S07 七态判断与重试策略", () => {
  const waiting: PlanQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): PlanQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });
  const success = (data: S07PlanOverview): PlanQuery => ({ data, error: null, status: "success", fetchStatus: "idle" });

  it("无缓存时分别显示加载、离线、出错与受限", () => {
    expect(planView(waiting)).toMatchObject({ state: "loading", offline: false });
    expect(planView({ ...waiting, fetchStatus: "paused" })).toMatchObject({ state: "offline", offline: true });
    expect(planView(failed(new TypeError("Failed to fetch")))).toMatchObject({ state: "offline", offline: true });
    expect(planView(failed(new ApiError("COMMON_INTERNAL")))).toMatchObject({ state: "error", offline: false });
    expect(planView(failed(new ApiError("COMMON_NOT_FOUND"))).state).toBe("error");
    expect(planView(failed(new ApiError("COMMON_FORBIDDEN")))).toMatchObject({ state: "restricted", offline: false });
  });

  it("有计划为正常，无计划为空；受限和数据不足保留数据供局部提示", () => {
    const normal = planFixture("junior-accounting");
    expect(planView(success(normal))).toMatchObject({ state: "normal", data: normal, offline: false });
    expect(planView(success({ ...normal, has_plan: false })).state).toBe("empty");
    const restricted = { ...normal, institution_locked: true };
    expect(planView(success(restricted))).toMatchObject({ state: "normal", data: { institution_locked: true } });
    const insufficient = { ...normal, health_estimated: true };
    expect(planView(success(insufficient))).toMatchObject({ state: "normal", data: { health_estimated: true } });
  });

  it("缓存存在时离线继续显示原计划，并暴露只读标记；服务错误也保留缓存", () => {
    const data = planFixture("junior-accounting");
    expect(planView({ ...failed(new TypeError("Failed to fetch")), data })).toMatchObject({ state: "normal", data, offline: true });
    expect(planView({ ...waiting, data, fetchStatus: "paused" })).toMatchObject({ state: "normal", data, offline: true });
    expect(planView({ ...failed(new ApiError("COMMON_INTERNAL")), data })).toMatchObject({ state: "normal", data, offline: false });
  });

  it("网络与服务错误最多再试一次，权限和其他 4xx 不重试", () => {
    for (const error of [new TypeError("Failed to fetch"), new ApiError("COMMON_INTERNAL")]) {
      expect(shouldRetry(0, error)).toBe(true);
      expect(shouldRetry(1, error)).toBe(false);
    }
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_NOT_FOUND"))).toBe(false);
  });
});

describe("S07 视图参数", () => {
  it("八个视图均可读，缺省或非法值回到本周", () => {
    expect(VIEWS).toEqual(["week", "scope", "ranking", "log", "calendar", "rounds", "today", "sandbox"]);
    for (const view of VIEWS) expect(readView(view)).toBe(view);
    for (const value of [null, "", "unknown", "WEEK"]) expect(readView(value)).toBe("week");
  });
});

describe("S07 文案", () => {
  // 回归：交接时健康度提示借用了 plan.calibrate.weeks（登记语义是“声明与实测连续相差几周后提议校准”，来源 S03-05）。
  // 参数登记表里没有“健康度最少观察窗”，在补登记之前，这句文案不写周数，也不留无参数兜底的插值。
  it("健康度估算说明不写规则周数，也不留没有参数来源的插值", () => {
    const insufficient: Record<string, string> = copy.state.insufficient_data;
    for (const [key, value] of Object.entries(insufficient)) {
      expect(value, `state.insufficient_data.${key} 不应带没有参数来源的插值`).not.toContain("{{");
    }
    expect(insufficient.body, "没有登记观察窗参数之前，正文不写死周数").not.toMatch(/[0-9一二两三四五六七八九十]\s*周/);
  });

  it("本页文案不出现禁用语", () => {
    const banned = ["保过", "必过", "包过", "稳过", "押题", "知识图谱", "图谱", "入学诊断", "入学测评", "落后"];
    const text = JSON.stringify(copy);
    for (const word of banned) expect(text, `文案里不应出现“${word}”`).not.toContain(word);
  });
});

/** 生成钩子的 GET 请求直接交给 MSW 使用的同一假数据接口。 */
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

describe("S07 页面挂载", () => {
  it("正常态显示学习计划、轮次路线与完整本周安排", async () => {
    stubFetch(setup().api);
    const { host, unmount } = await mountAt(pathTo("S07"), <App />);
    try {
      await settle(() => host.querySelector('[data-testid="week-grid"]') !== null);
      expect(heading(host)).toBe(copy.header.title);
      expect(host.textContent).toContain(planFixture("junior-accounting").exam_name);
      expect(host.querySelector('[data-testid="round-timeline"]')?.textContent).toContain(copy.timeline.title);
      expect(host.querySelector('[data-testid="week-grid"]')?.children).toHaveLength(7);
      expect(host.textContent).toContain(copy.week.budget);
      expect(host.textContent).toContain(copy.week.buffer);
    } finally {
      await unmount();
    }
  });

  it("空态保留页头，并提供起点报告的选方案入口", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt(pathTo("S07"), <App />);
    try {
      await settle(() => host.querySelector(".ui-state--empty") !== null);
      const empty = host.querySelector(".ui-state--empty");
      expect(heading(host)).toBe(copy.header.title);
      expect(empty?.textContent).toContain(copy.state.empty.title);
      expect(empty?.textContent).toContain(copy.state.empty.body);
      expect(linkByText(empty, copy.state.empty.action)?.getAttribute("href")).toBe(pathTo("S05"));
      expect(host.querySelector('[data-testid="week-grid"]')).toBeNull();
    } finally {
      await unmount();
    }
  });

  it("出错态重试后显示错误提示和重试按钮", async () => {
    stubFetch(setup("error").api);
    const { host, unmount } = await mountAt(pathTo("S07"), <App />);
    try {
      await settle(() => host.querySelector(".ui-state--error") !== null, 250);
      const error = host.querySelector(".ui-state--error");
      expect(error?.textContent).toContain(copy.state.error.title);
      expect(error?.getAttribute("role")).toBe("alert");
      expect([...(error?.querySelectorAll("button") ?? [])].map((button) => button.textContent)).toContain("重试");
    } finally {
      await unmount();
    }
  });

  // 回归：交接时把一个含 <p> 的片段传给公共 PageState 的 body，而 PageState 内部本来就用 <p> 包 body，
  // 形成 <p> 套 <p>，React 会报 DOM 嵌套错误。实测天数改走 PageState 现成的 counts 与 missing，不改公共组件。
  it("数据不足提示不嵌套段落，实测天数走原始计数", async () => {
    stubFetch(setup("insufficient_data").api);
    const { host, unmount } = await mountAt(pathTo("S07"), <App />);
    try {
      await settle(() => host.querySelector(".ui-state--insufficient_data") !== null);
      const panel = host.querySelector(".ui-state--insufficient_data");
      const body = panel?.querySelector(".ui-state__body");
      expect(body?.textContent).toBe(copy.state.insufficient_data.body);
      expect(body?.querySelector("p"), "PageState 的 body 已经是 <p>，本页不能再往里塞 <p>").toBeNull();
      expect(panel?.querySelectorAll("p p")).toHaveLength(0);
      const counts = panel?.querySelector(".ui-kv");
      expect(counts?.textContent).toContain(copy.state.insufficient_data.observed);
      expect(counts?.textContent).toContain(formatDays(6));
      expect(panel?.querySelector(".ui-state__missing")?.textContent).toBe(copy.state.insufficient_data.missing);
    } finally {
      await unmount();
    }
  });

  it("数据不足只限制健康度口径，本周安排与轮次路线照常显示", async () => {
    stubFetch(setup("insufficient_data").api);
    const { host, unmount } = await mountAt(pathTo("S07"), <App />);
    try {
      await settle(() => host.querySelector('[data-testid="week-grid"]') !== null);
      expect(host.querySelector('[data-testid="round-timeline"]')).not.toBeNull();
      expect(host.querySelector('[data-testid="week-grid"]')?.children).toHaveLength(7);
      expect(host.querySelector(".ui-state--insufficient_data")).not.toBeNull();
    } finally {
      await unmount();
    }
  });

  it("机构受限只展示局部提示，学习范围仍可查看且操作只提示即将上线", async () => {
    stubFetch(setup("restricted").api);
    const { host, unmount } = await mountAt(`${pathTo("S07")}?view=scope`, <App />);
    try {
      await settle(() => host.querySelector(".ui-state--restricted") !== null && host.textContent?.includes(copy.scope.title) === true);
      expect(host.querySelector(".ui-state--restricted")?.textContent).toContain(copy.state.restricted.body);
      expect(host.querySelector('[data-testid="round-timeline"]')).not.toBeNull();
      expect(host.textContent).toContain(copy.scope.title);
      const remove = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.trim() === copy.scope.remove,
      );
      expect(remove).toBeDefined();
      expect(remove?.disabled).toBe(false);
      const before = host.querySelector("table")?.textContent;
      await click(remove);
      await settle(() => [...host.querySelectorAll('[role="status"]')].some((status) => status.textContent?.includes(copy.soon)));
      expect([...host.querySelectorAll('[role="status"]')].some((status) => status.textContent?.includes(copy.soon))).toBe(true);
      expect(host.querySelector("table")?.textContent).toBe(before);
    } finally {
      await unmount();
    }
  });
});
