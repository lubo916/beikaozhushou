// S26 简版：四考试假数据经生成的 Zod 校验，七态映射与重试策略。
import { describe, expect, it } from "vitest";
import { act } from "react";
import { QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { getGetEnrollmentDecisionQueryKey } from "@exam-prep/contract";
import { App } from "../../App.tsx";
import { DEMO_CONTEXT, mount, settle, testClient } from "../../app/testing.tsx";
import copy from "../../i18n/zh-CN/S26.json";
import { ApiError } from "@exam-prep/contract/errors";
import * as schemas from "@exam-prep/contract/zod";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { decisionFixture } from "../../mocks/pages/S26.ts";
import { decisionView, shouldRetry, type DecisionQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const parser = (schemas as Record<string, unknown>)["getEnrollmentDecisionResponse"] as Parser | undefined;
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => Date.parse("2026-10-21T02:00:00Z"),
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  return {
    control,
    get: () =>
      api.handle({ method: "GET", url: "http://localhost/api/v1/learner/enrollment-decision", headers: new Headers(), body: undefined }),
  };
}

describe("S26 只读假数据", () => {
  it("四个演示考试的正常、空、受限和不足响应均符合生成契约", async () => {
    expect(typeof parser?.safeParse).toBe("function");
    for (const state of ["", "empty", "restricted", "insufficient_data"]) {
      const { control, get } = setup(state);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const result = await get();
        expect(result.kind).toBe("json");
        if (result.kind !== "json") throw new Error("接口没有返回 JSON");
        expect(result.status).toBe(200);
        const checked = parser?.safeParse(result.body);
        expect(checked?.success, String(checked?.error)).toBe(true);
      }
    }
  });
  it("只按配置显示已挂载数据；没有数据的考试不虚构选项", () => {
    expect(decisionFixture("junior-accounting").available).toBe(true);
    for (const id of ["teacher-qualification", "cet-6", "ds-final-custom"]) {
      expect(decisionFixture(id).available).toBe(false);
      expect(decisionFixture(id).items).toEqual([]);
    }
  });
});

describe("S26 七态与重试", () => {
  const pending: DecisionQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): DecisionQuery => ({ ...pending, status: "error", fetchStatus: "idle", error });
  const normal = decisionFixture("junior-accounting");
  const success = (data = normal): DecisionQuery => ({ data, error: null, status: "success", fetchStatus: "idle" });
  it("根据请求结果和返回数据区分七态", () => {
    expect(decisionView(pending).state).toBe("loading");
    expect(decisionView({ ...pending, fetchStatus: "paused" }).state).toBe("offline");
    expect(decisionView(failed(new TypeError("网络断开"))).state).toBe("offline");
    expect(decisionView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(decisionView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
    expect(decisionView(success()).state).toBe("normal");
    expect(decisionView(success({ ...normal, available: false, items: [] })).state).toBe("empty");
    expect(decisionView(success({ ...normal, access_limited: true })).state).toBe("restricted");
    expect(decisionView(success({ ...normal, profile_complete: false })).state).toBe("insufficient_data");
  });
  it("有缓存但断网保留来源信息并标记过期；网络和服务异常最多再试一次，4xx 不重试", () => {
    expect(decisionView({ ...success(), fetchStatus: "paused" }).stale).toBe(true);
    expect(shouldRetry(0, new TypeError("网络断开"))).toBe(true);
    expect(shouldRetry(1, new TypeError("网络断开"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});

describe("S26 回归：强制状态与离线缓存", () => {
  it("四考试的受限和数据不足不会被未挂载空态吞掉", async () => {
    for (const state of ["restricted", "insufficient_data"] as const) {
      const { control, get } = setup(state);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const result = await get();
        if (result.kind !== "json") throw new Error("接口没有返回 JSON");
        expect(
          decisionView({ data: result.body as ReturnType<typeof decisionFixture>, error: null, status: "success", fetchStatus: "idle" })
            .state,
          exam.key,
        ).toBe(state);
      }
    }
  });
  it("页面已有缓存后断网，仍保留选项并显示离线提示", async () => {
    const client = testClient(DEMO_CONTEXT);
    client.setQueryData(getGetEnrollmentDecisionQueryKey(), decisionFixture("junior-accounting"));
    onlineManager.setOnline(false);
    const page = await mount(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/enroll"]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    try {
      await settle(() => page.host.querySelector('[data-testid="s26-source"]') !== null);
      await act(async () => {
        void client.refetchQueries({ queryKey: getGetEnrollmentDecisionQueryKey(), exact: true });
      });
      await settle(() => page.host.textContent?.includes(copy.state.offline.title) === true);
      expect(page.host.textContent).toContain(copy.state.offline.title);
      expect(page.host.querySelector("main .ui-table-wrap")).not.toBeNull();
      expect(page.host.querySelector("main .ui-state--offline")).toBeNull();
    } finally {
      await page.unmount();
      client.clear();
      onlineManager.setOnline(true);
    }
  });
});
