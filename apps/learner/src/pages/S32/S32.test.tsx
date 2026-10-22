import { describe, expect, it } from "vitest";
import { act } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { getGetPrivacyCenterQueryKey } from "@exam-prep/contract";
import { click, mount, settle, testClient } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S32.json";
import Page from "./index.tsx";
import type { S32PrivacyCenter } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import * as schemas from "@exam-prep/contract/zod";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { privacyView, shouldRetry, type PrivacyQuery } from "./data.ts";
interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (schemas as Record<string, unknown>)["getPrivacyCenterResponse"] as Parser;
function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((e) => e.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : "?state=" + state),
    clock: () => Date.parse("2026-10-22T10:00:00Z"),
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  const home = async () => {
    const outcome = await api.handle({
      method: "GET",
      url: "http://localhost/api/v1/account/privacy-center",
      headers: new Headers(),
      body: undefined,
    });
    expect(outcome.kind).toBe("json");
    if (outcome.kind !== "json") throw new Error("缺少 S32 响应");
    expect(outcome.status).toBe(200);
    const result = parser.safeParse(outcome.body);
    expect(result.success, String(result.error)).toBe(true);
    return outcome.body as S32PrivacyCenter;
  };
  return { control, home };
}
describe("S32 假数据与授权边界", () => {
  it("四个演示考试及正常、空、受限、数据不足均通过生成的 Zod", async () => {
    for (const state of ["", "empty", "restricted", "insufficient_data"]) {
      const { control, home } = setup(state);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await home();
        expect(data.data_source).toBe("sample");
      }
    }
  });
  it("机构个人数据默认不勾选、敏感数据不可授权、模型训练和分析单独关闭", async () => {
    const data = await setup().home();
    for (const key of ["progress", "mistakes", "notes"])
      expect(data.institution_grants.find((g) => g.key === key)).toMatchObject({ enabled: false, editable: true });
    for (const key of ["emotions", "conversations"])
      expect(data.institution_grants.find((g) => g.key === key)).toMatchObject({ enabled: false, editable: false });
    expect(data.settings.find((s) => s.key === "training")?.enabled).toBe(false);
    expect(data.settings.find((s) => s.key === "analysis")?.enabled).toBe(false);
  });
  it("受限只是注销冷静期、数据不足不阻断设置，未成年人演示不可关闭", async () => {
    const restricted = await setup("restricted").home();
    expect(restricted.deregistration_pending).toBe(true);
    expect(restricted.devices.length).toBeGreaterThan(0);
    const insufficient = await setup("insufficient_data").home();
    expect(insufficient.display_state).toBe("insufficient_data");
    expect(insufficient.institution_grants.length).toBeGreaterThan(0);
    const { control, home } = setup();
    control.setExam("ds");
    expect((await home()).minor_mode).toBe(true);
  });
  it("空态没有可导出资产", async () => {
    const data = await setup("empty").home();
    expect(data.data_categories).toEqual([]);
    expect(data.tasks).toEqual([]);
  });
});
describe("S32 七态与重试策略", () => {
  const waiting: PrivacyQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  it("加载、离线、错误和接口拒绝分别映射", () => {
    expect(privacyView(waiting).state).toBe("loading");
    expect(privacyView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
    expect(privacyView({ ...waiting, status: "error", error: new TypeError("offline") }).state).toBe("offline");
    expect(privacyView({ ...waiting, status: "error", error: new ApiError("COMMON_INTERNAL") }).state).toBe("error");
    expect(privacyView({ ...waiting, status: "error", error: new ApiError("COMMON_FORBIDDEN") }).state).toBe("restricted");
  });
  it("接口给出正常、空、受限与不适用状态；离线缓存保留内容", async () => {
    const data = await setup().home();
    for (const state of ["normal", "empty", "restricted", "insufficient_data"] as const)
      expect(privacyView({ data: { ...data, display_state: state }, error: null, status: "success", fetchStatus: "idle" }).state).toBe(
        state,
      );
    expect(privacyView({ data, error: new TypeError("offline"), status: "error", fetchStatus: "idle" })).toMatchObject({
      state: "normal",
      stale: true,
    });
  });
  it("网络与服务异常重试一次；权限与客户端错误不重试", () => {
    expect(shouldRetry(0, new TypeError("offline"))).toBe(true);
    expect(shouldRetry(1, new TypeError("offline"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});

describe("S32 缓存权限与离线操作回归", () => {
  it("已有缓存后收到403，不继续展示原隐私数据", async () => {
    const data = await setup().home();
    expect(privacyView({ data, error: new ApiError("COMMON_FORBIDDEN"), status: "error", fetchStatus: "idle" })).toMatchObject({
      state: "restricted",
      data: undefined,
      stale: false,
    });
  });
  it("无权限不误报离线，且导出不可点", async () => {
    const client = testClient();
    const key = getGetPrivacyCenterQueryKey();
    client.setQueryData(key, await setup().home());
    const { host, unmount } = await mount(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/privacy"]}>
          <Page />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    try {
      await act(async () => {
        client
          .getQueryCache()
          .find({ queryKey: key })
          ?.setState({ data: undefined, status: "error", error: new ApiError("COMMON_FORBIDDEN"), fetchStatus: "idle" });
      });
      await settle(() => host.querySelector(".ui-state--restricted") !== null);
      expect(host.querySelector(".ui-state--restricted")?.textContent).not.toContain(copy.state.offline.body);
      const button = [...host.querySelectorAll("button")].find((node) => node.textContent === copy.export.all);
      expect(button?.disabled).toBe(true);
    } finally {
      await unmount();
      client.clear();
    }
  });
  it.each(["privacy", "assets", "account"])("缓存离线的%s视图不能发起授权、导出或危险操作", async (view) => {
    const client = testClient();
    const key = getGetPrivacyCenterQueryKey();
    client.setQueryData(key, await setup().home());
    const { host, unmount } = await mount(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/privacy?view=" + view]}>
          <Page />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    try {
      await act(async () => {
        client
          .getQueryCache()
          .find({ queryKey: key })
          ?.setState({ status: "error", error: new TypeError("offline"), fetchStatus: "paused" });
      });
      await settle(() => host.textContent?.includes(copy.state.offline.cached) === true);
      expect(host.textContent).toContain(copy.state.offline.cached);
      const controls = [...host.querySelectorAll("button")].filter((node) => node.getAttribute("role") !== "tab");
      for (const control of controls) {
        await click(control);
        expect(document.querySelector('dialog[open], [role="dialog"]'), control.textContent ?? "").toBeNull();
      }
    } finally {
      await unmount();
      client.clear();
    }
  });
});
