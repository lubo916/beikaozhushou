import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import type { MeContext, S05StartReport } from "@exam-prep/contract";
import { restoreReport, storeReport } from "./cache.ts";
import { App } from "../../App.tsx";
import { mount, settle, testClient } from "../../app/testing.tsx";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
function network() {
  const control = new DevControl({ examKeys: fixtures.exams.map((exam) => exam.key), defaultExamKey: fixtures.defaultKey });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  let offline = false;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (offline) throw new TypeError("Failed to fetch");
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const result = await api.handle({
      method: init?.method ?? "GET",
      url: new URL(url, "http://localhost").href,
      headers: new Headers(init?.headers),
      body: undefined,
    });
    if (result.kind !== "json") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(result.body), { status: result.status, headers: { "content-type": "application/json" } });
  });
  return {
    control,
    api,
    offline: () => {
      offline = true;
    },
  };
}
function open(path = "/start-report") {
  return mount(
    <QueryClientProvider client={testClient()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});
describe("S05 离线刷新缓存", () => {
  it("成功加载后使用新查询客户端离线刷新，仍显示上次报告与离线提示", async () => {
    const connection = network();
    const first = await open();
    await settle(() => first.host.querySelector('input[name="s05-scheme"]') !== null);
    expect(first.host.querySelector('input[name="s05-scheme"]')).not.toBeNull();
    await first.unmount();
    connection.offline();
    const refreshed = await open();
    await settle(() => refreshed.host.querySelector(".ui-state--offline") !== null);
    expect(refreshed.host.querySelector(".ui-state--offline")).not.toBeNull();
    expect(refreshed.host.querySelector('input[name="s05-scheme"]')).not.toBeNull();
    await refreshed.unmount();
  });
});

async function cachedFixture(view: "normal" | "quick" = "normal") {
  const fixture = network();
  async function body(path: string) {
    const result = await fixture.api.handle({
      method: "GET",
      url: `http://localhost/api/v1/${path}`,
      headers: new Headers(),
      body: undefined,
    });
    if (result.kind !== "json" || result.status !== 200) throw new Error("S05 缓存测试数据加载失败");
    return result.body;
  }
  const report = (await body(`learner/start-report/${view}`)) as S05StartReport;
  const context = (await body("me/context")) as MeContext;
  return { report, context };
}
describe("S05 缓存数据边界", () => {
  it("按用户、目标日期、目标分数、考试和视图隔离，显式选择其他考试不读取旧报告", async () => {
    const { report, context } = await cachedFixture();
    const quick = (await cachedFixture("quick")).report;
    storeReport(report);
    storeReport(quick);
    expect(restoreReport("normal", context)?.view).toBe("normal");
    expect(restoreReport("quick", context)?.view).toBe("quick");
    expect(restoreReport("normal", { ...context, user: { ...context.user, id: "0190a000-0000-7000-8000-000000000099" } })).toBeUndefined();
    if (context.goal === undefined) throw new Error("示例缺少目标");
    expect(restoreReport("normal", { ...context, goal: { ...context.goal, exam_id: "another-exam" } })).toBeUndefined();
    expect(restoreReport("normal", { ...context, goal: { ...context.goal, target_date: "2028-01-01" } })).toBeUndefined();
    expect(restoreReport("normal", { ...context, goal: { ...context.goal, target_score: 100 } })).toBeUndefined();
    expect(restoreReport("normal", context, "another-exam")).toBeUndefined();
    expect(restoreReport("normal", undefined, report.demo_exam_key, true)?.viewer_id).toBe(report.viewer_id);
    expect(restoreReport("normal", undefined, "another-exam", true)).toBeUndefined();
  });
  it("缺缓存、损坏缓存或契约不通过时保留无缓存退路；空报告不覆盖最近有效报告", async () => {
    const { report, context } = await cachedFixture();
    expect(restoreReport("normal", context)).toBeUndefined();
    storeReport(report);
    storeReport({ ...report, available: false });
    expect(restoreReport("normal", context)?.exam_id).toBe(report.exam_id);
    const entry = Object.keys(sessionStorage).find((key) => key.startsWith("bk.s05.report:") && !key.endsWith(":active"));
    if (entry === undefined) throw new Error("报告缓存未写入");
    sessionStorage.setItem(entry, JSON.stringify({ ...report, time: { available_minutes: "bad" } }));
    expect(restoreReport("normal", context)).toBeUndefined();
    sessionStorage.setItem(entry, "{invalid JSON");
    expect(restoreReport("normal", context)).toBeUndefined();
  });
  it("只缓存普通报告时，离线打开快速定位不会串用普通报告", async () => {
    const connection = network();
    const first = await open();
    await settle(() => first.host.querySelector('input[name="s05-scheme"]') !== null);
    expect(first.host.querySelector('input[name="s05-scheme"]')).not.toBeNull();
    await first.unmount();
    connection.offline();
    const quick = await open("/start-report?view=quick");
    await settle(() => quick.host.querySelector(".ui-state--offline") !== null);
    expect(quick.host.querySelector(".ui-state--offline")).not.toBeNull();
    expect(quick.host.querySelector('input[name="s05-scheme"]')).toBeNull();
    await quick.unmount();
  });
});
