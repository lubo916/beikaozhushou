import { mountAt, settle } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/O01.json";
import "./aggregate.test.ts";
import "./state.test.ts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import * as schemas from "@exam-prep/contract/zod";
import { handleO01, o01Fixture } from "../../mocks/pages/O01.ts";
import { workbenchView, shouldRetry } from "./view.ts";
interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const parser = (schemas as Record<string, unknown>)["getO01WorkbenchResponse"] as Parser | undefined;
const request = (query: string) =>
  handleO01({ method: "GET", url: `http://localhost/api/v1/org/workbench?${query}`, headers: new Headers(), body: undefined });
const waiting = { data: undefined, error: null, status: "pending" as const, fetchStatus: "fetching" as const };
describe("O01 机构工作台", () => {
  it("四考试和四数据变体符合生成契约", async () => {
    expect(typeof parser?.safeParse).toBe("function");
    for (const exam of ["kj", "js", "en", "ds"])
      for (const state of ["normal", "empty", "restricted", "insufficient_data"]) {
        const response = await request(`exam=${exam}&state=${state}`);
        if (response.kind !== "json") throw new Error("应返回示例 JSON");
        const parsed = parser?.safeParse(response.body);
        expect(parsed?.success, String(parsed?.error)).toBe(true);
      }
  });
  it("受限和样本不足响应隐藏汇总统计，变体不污染原始数据", async () => {
    for (const state of ["restricted", "insufficient_data"]) {
      const response = await request(`state=${state}`);
      if (response.kind !== "json") throw new Error("应返回示例 JSON");
      expect(response.body).toMatchObject({ metrics: [], classes: [] });
    }
    expect(o01Fixture().metrics.length).toBeGreaterThan(0);
  });
  it("角色过滤待办、下级范围保持本级、组织预设改变指标", async () => {
    const advisor = await request("role=advisor&scope=all");
    const enterprise = await request("organization_type=enterprise");
    if (advisor.kind !== "json" || enterprise.kind !== "json") throw new Error("应返回示例 JSON");
    expect(advisor.body).toMatchObject({ organization_name: "启明学习中心 · 东城校区", todos: [{ id: "contact" }] });
    expect(enterprise.body).toMatchObject({ metrics: expect.arrayContaining([expect.objectContaining({ id: "required" })]) });
  });
  it("请求状态与缓存断网映射正确", () => {
    expect(workbenchView(waiting).state).toBe("loading");
    expect(workbenchView({ ...waiting, status: "error", error: new TypeError("offline") }).state).toBe("offline");
    expect(workbenchView({ ...waiting, status: "error", error: new ApiError("COMMON_INTERNAL") }).state).toBe("error");
    expect(workbenchView({ ...waiting, status: "error", error: new TypeError("offline"), data: o01Fixture() })).toMatchObject({
      state: "normal",
      stale: true,
    });
    expect(workbenchView({ ...waiting, status: "success", data: { ...o01Fixture(), classes: [], todos: [] } }).state).toBe("empty");
  });
  it("网络和服务异常重试一次，权限错误不重试", () => {
    expect(shouldRetry(0, new TypeError("offline"))).toBe(true);
    expect(shouldRetry(1, new TypeError("offline"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});

// 与 S10 样板一致：组件测试直接连接同一 mock handler，不依赖 Vitest 的静态资源目录。
// 生成钩子和请求适配器仍实际运行；真正 Service Worker 链路由本页 e2e 覆盖。
function stubPageTransport() {
  vi.stubEnv("VITE_MOCKS", "off");
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const asked = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const outcome = await handleO01({
      method: init?.method ?? "GET",
      url: new URL(asked, window.location.origin).href,
      headers: new Headers(init?.headers),
      body: undefined,
    });
    if (outcome.kind === "hang") return new Promise<Response>(() => undefined);
    if (outcome.kind !== "json") throw new TypeError("mock network unavailable");
    return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { "content-type": "application/json" } });
  });
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("O01 真实页面组件", () => {
  for (const state of ["normal", "empty", "error"]) {
    it(`${state} 经生成钩子与模拟接口挂载`, async () => {
      stubPageTransport();
      const mounted = await mountAt("/workbench?state=" + state);
      try {
        const selector = state === "normal" ? ".ui-cols" : `.ui-state--${state}`;
        await settle(() => mounted.host.querySelector(selector) !== null);
        expect(mounted.host.querySelector(selector), mounted.host.textContent ?? "").not.toBeNull();
        expect(mounted.host.querySelector("h1")?.textContent).toBe(copy.title);
        if (state === "empty") expect(mounted.host.textContent).toContain(copy.state.empty.body);
        if (state === "error") expect(mounted.host.textContent).toContain(copy.state.error.body);
      } finally {
        await mounted.unmount();
      }
    });
  }
});
