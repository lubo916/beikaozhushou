import { afterEach, describe, expect, it, vi } from "vitest";
import type { S05StartReport } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import * as schemas from "@exam-prep/contract/zod";
import { App } from "../../App.tsx";
import { heading, linkByText, mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S05.json";
import { createMockApi, type MockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { reportView, shouldRetry, type ReportQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const parser = (schemas as Record<string, unknown>)["getStartReportResponse"] as Parser | undefined;
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
function setup(state = "", view = "normal") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((e) => e.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => `?state=${state}`,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  async function report(): Promise<S05StartReport> {
    const result = await api.handle({
      method: "GET",
      url: `http://localhost/api/v1/learner/start-report/${view}`,
      headers: new Headers(),
      body: undefined,
    });
    expect(result.kind).toBe("json");
    if (result.kind !== "json") throw new Error("S05 接口没有返回报告");
    expect(result.status).toBe(200);
    const parsed = parser?.safeParse(result.body);
    expect(parsed?.success, String(parsed?.error)).toBe(true);
    return result.body as S05StartReport;
  }
  return { control, api, report };
}

describe("S05 报告数据边界", () => {
  it("四个考试、两种视图、空/游客/数据不足/锁定都通过生成的契约校验", async () => {
    expect(typeof parser?.safeParse).toBe("function");
    for (const view of ["normal", "quick"])
      for (const mode of ["", "empty", "restricted", "insufficient_data", "locked"]) {
        const { control, report } = setup(mode, view);
        for (const exam of fixtures.exams) {
          control.setExam(exam.key);
          const data = await report();
          expect(data.exam_name).toBe(exam.profile.name);
          expect(data.data_source).toBe("sample");
          if (data.map_health === "blocked") {
            expect(data.forecast).toBeUndefined();
            expect(data.repairs.length).toBeGreaterThan(0);
          }
        }
      }
  });
  it("快速定位区间更宽，证据量较少；游客仍能查看报告", async () => {
    const normal = await setup().report();
    const quick = await setup("", "quick").report();
    expect(quick.view).toBe("quick");
    expect(quick.forecast?.confidence).toBe("low");
    expect(quick.forecast?.low).toBeLessThan(normal.forecast?.low ?? 0);
    expect(quick.forecast?.high).toBeGreaterThan(normal.forecast?.high ?? 0);
    expect(quick.evidence_count).toBeLessThan(normal.evidence_count);
    expect((await setup("restricted").report()).available).toBe(true);
  });
  it("方案分别带完整第一周逐日内容；自建地图阻断时只交付原始分布与修复项", async () => {
    const { control, report } = setup();
    const data = await report();
    expect(data.schemes.map((s) => s.id)).toEqual(["steady", "standard", "sprint"]);
    for (const scheme of data.schemes) {
      expect(scheme.day_plan).toHaveLength(7);
      expect(scheme.day_plan.every((day) => day.minutes === scheme.daily_minutes && day.tasks.length > 0)).toBe(true);
    }
    control.setExam("ds");
    const blocked = await report();
    expect(blocked.map_health).toBe("blocked");
    expect(blocked.forecast).toBeUndefined();
    expect(blocked.grid.length).toBeGreaterThan(0);
    expect(blocked.repairs.length).toBeGreaterThan(0);
  });
});

describe("S05 请求状态与重试", () => {
  const pending: ReportQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  it("加载、空、正常与离线由请求结果映射，有缓存时保留报告", async () => {
    expect(reportView(pending).state).toBe("loading");
    expect(reportView({ ...pending, fetchStatus: "paused" }).state).toBe("offline");
    const data = await setup().report();
    expect(reportView({ ...pending, data, status: "success" }).state).toBe("normal");
    expect(reportView({ ...pending, data: { ...data, available: false }, status: "success" }).state).toBe("empty");
    const stale = reportView({ data, error: new TypeError("Failed to fetch"), status: "error", fetchStatus: "idle" });
    expect(stale.state).toBe("normal");
    expect(stale.stale).toBe(true);
    expect(stale.data).toBe(data);
    expect(reportView({ ...pending, status: "error", error: new ApiError("COMMON_INTERNAL") }).state).toBe("error");
  });
  it("网络/服务异常只重试一次，权限类错误不重试", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});
function stubFetch(api: MockApi) {
  const requests: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    requests.push(url);
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
  return requests;
}
afterEach(() => vi.unstubAllGlobals());
describe("S05 页面", () => {
  it("完整报告与快速定位均显示方案，只有保存时才出现登录动作", async () => {
    for (const view of ["normal", "quick"]) {
      const requests = stubFetch(setup("", view).api);
      const { host, unmount } = await mountAt(`/start-report?view=${view}`, <App />);
      await settle(() => host.querySelector('input[name="s05-scheme"]') !== null);
      expect(
        requests.some((url) => new URL(url, "http://localhost").pathname.endsWith(`/start-report/${view}`)),
        requests.join("\n"),
      ).toBe(true);
      expect(heading(host)).toBe(copy.header.title);
      expect(host.textContent).toContain(copy.scope.title);
      expect(host.textContent).toContain(copy.rounds.title);
      expect(linkByText(host, copy.plan.login)).toBeUndefined();
      if (view === "quick") expect(host.querySelector(".ui-state--insufficient_data")?.textContent).toContain(copy.state.quick.body);
      await unmount();
    }
  });
  it("空报告保留页头并可去摸底诊断", async () => {
    stubFetch(setup("empty").api);
    const { host, unmount } = await mountAt("/start-report", <App />);
    await settle(() => host.querySelector(".ui-state--empty") !== null);
    expect(heading(host)).toBe(copy.header.title);
    expect(linkByText(host, copy.state.empty.action)?.getAttribute("href")).toBe("/diagnosis");
    await unmount();
  });
  it("体检不通过只锁预测，修复清单、方案与生成计划照常", async () => {
    const { control, api } = setup();
    control.setExam("ds");
    stubFetch(api);
    const { host, unmount } = await mountAt("/start-report", <App />);
    await settle(() => host.querySelector('input[name="s05-scheme"]') !== null);
    expect(host.querySelector(".ui-state--locked")?.textContent).toContain(copy.locked.title);
    expect(host.querySelectorAll("#s05-repairs li").length).toBeGreaterThan(0);
    expect(host.querySelectorAll('input[name="s05-scheme"]')).toHaveLength(3);
    expect(host.textContent).not.toContain(copy.hero.forecast);
    expect(host.textContent).not.toContain(copy.schemes.expected);
    expect(host.textContent).toContain(copy.time.title);
    expect(host.textContent).toContain(copy.gap.locked_hint);
    expect(linkByText(host, copy.locked.fix)?.getAttribute("href")).toBe("/map");
    await unmount();
  });
  it("强制锁定时修复清单逐项列出", async () => {
    stubFetch(setup("locked").api);
    const { host, unmount } = await mountAt("/start-report", <App />);
    await settle(() => host.querySelector("#s05-repairs li") !== null);
    const items = [...host.querySelectorAll("#s05-repairs li")].map((item) => item.textContent ?? "");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((text) => text.includes(copy.locked.fix))).toBe(true);
    await unmount();
  });
});
