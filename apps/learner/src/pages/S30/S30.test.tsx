import { describe, expect, it } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import * as schemas from "@exam-prep/contract/zod";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { roomView, shouldRetry, type RoomQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const parser = (schemas as Record<string, unknown>)["getS30StudyRoomResponse"] as Parser | undefined;
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const MODES = ["", "empty", "restricted", "insufficient_data"] as const;

describe("S30 假数据契约", () => {
  it("四考试的正常、空、受限和人数不足数据均通过生成的 Zod", async () => {
    expect(typeof parser?.safeParse).toBe("function");
    for (const state of MODES) {
      const control = new DevControl({
        examKeys: fixtures.exams.map((exam) => exam.key),
        defaultExamKey: fixtures.defaultKey,
        search: () => (state === "" ? "" : `?state=${state}`),
        clock: () => Date.parse("2026-10-22T02:00:00Z"),
      });
      const api = createMockApi({ control, db: new MockDb(fixtures), routes });
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const outcome = await api.handle({
          method: "GET",
          url: "http://localhost/api/v1/engagement/study-room",
          headers: new Headers(),
          body: undefined,
        });
        expect(outcome.kind).toBe("json");
        if (outcome.kind !== "json") throw new Error("自习室没有返回 JSON");
        expect(outcome.status).toBe(200);
        const result = parser?.safeParse(outcome.body);
        expect(result?.success, String(result?.error)).toBe(true);
        const body = outcome.body as Record<string, unknown>;
        expect(body["data_source"]).toBe("sample");
        expect(body["page_state"]).toBe(state === "" ? "normal" : state);
        expect(body["minor_mode"]).toBe(state === "restricted");
        if (state === "empty") expect(body["rooms"]).toEqual([]);
      }
    }
  });
});

describe("S30 请求七态和重试", () => {
  const pending: RoomQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): RoomQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });
  it("加载、离线、受限和服务错误各自映射", () => {
    expect(roomView(pending).state).toBe("loading");
    expect(roomView({ ...pending, fetchStatus: "paused" }).state).toBe("offline");
    expect(roomView(failed(new TypeError("网络断开"))).state).toBe("offline");
    expect(roomView(failed(new ApiError("COMMON_FORBIDDEN"))).state).toBe("restricted");
    expect(roomView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
  });
  it("只重试一次网络或服务异常，不重试 4xx", () => {
    expect(shouldRetry(0, new TypeError("网络断开"))).toBe(true);
    expect(shouldRetry(1, new TypeError("网络断开"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});
