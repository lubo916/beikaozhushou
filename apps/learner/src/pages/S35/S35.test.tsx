import { describe, expect, it } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import * as schemas from "@exam-prep/contract/zod";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { messagesView, shouldRetry, type MessagesQuery } from "./data.ts";

const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const parser = (schemas as Record<string, unknown>)["getS35MessagesResponse"] as Parser | undefined;
describe("S35 生成契约与四考试假数据", () => {
  for (const exam of fixtures.exams)
    for (const state of ["normal", "empty", "restricted", "insufficient_data"]) {
      it(`${exam.key} / ${state} 通过生成 Zod，并正确区分局部状态`, async () => {
        const control = new DevControl({
          examKeys: fixtures.exams.map((item) => item.key),
          defaultExamKey: exam.key,
          search: () => `?state=${state}`,
        });
        const api = createMockApi({ db: new MockDb(fixtures), control, routes });
        const outcome = await api.handle({
          method: "GET",
          url: "http://localhost/api/v1/engagement/messages",
          headers: new Headers(),
          body: undefined,
        });
        expect(outcome.kind).toBe("json");
        if (outcome.kind !== "json") throw new Error("没有消息响应");
        expect(outcome.status).toBe(200);
        const parsed = parser?.safeParse(outcome.body);
        expect(parsed?.success, String(parsed?.error)).toBe(true);
        const data = outcome.body as { notifications: unknown[]; push_enabled: boolean; insufficient_data: boolean; tickets: unknown[] };
        expect(data.notifications.length === 0).toBe(state === "empty");
        expect(data.push_enabled).toBe(state !== "restricted");
        expect(data.insufficient_data).toBe(state === "insufficient_data");
        expect(data.tickets.length).toBeGreaterThan(0);
      });
    }
});

describe("S35 七态判断与重试", () => {
  const query = (overrides: Partial<MessagesQuery> = {}): MessagesQuery => ({
    data: undefined,
    status: "pending",
    fetchStatus: "fetching",
    error: null,
    ...overrides,
  });
  it("区分加载、接口错误、离线与访问受限", () => {
    expect(messagesView(query()).state).toBe("loading");
    expect(messagesView(query({ status: "error", fetchStatus: "idle", error: new ApiError("COMMON_INTERNAL") })).state).toBe("error");
    expect(messagesView(query({ status: "error", fetchStatus: "idle", error: new TypeError("network") })).state).toBe("offline");
    expect(messagesView(query({ fetchStatus: "paused" })).state).toBe("offline");
    expect(messagesView(query({ status: "error", error: new ApiError("COMMON_FORBIDDEN") })).state).toBe("restricted");
  });
  it("4xx 不重试，网络与服务异常只再试一次", () => {
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(1, new TypeError("network"))).toBe(false);
  });
});
