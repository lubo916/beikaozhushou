import { describe, expect, it } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import * as schemas from "@exam-prep/contract/zod";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { settingsView, shouldRetry } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const parser = (schemas as Record<string, unknown>)["getS33SettingsResponse"] as Parser;
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());

describe("S33 设置数据", () => {
  it("四考试与数据变体均通过生成契约，保留平台允许选项", async () => {
    for (const state of ["normal", "empty", "restricted", "insufficient_data"]) {
      const control = new DevControl({
        examKeys: fixtures.exams.map((exam) => exam.key),
        defaultExamKey: fixtures.defaultKey,
        search: () => `?state=${state}`,
      });
      const api = createMockApi({ db: new MockDb(fixtures), control, routes });
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const result = await api.handle({
          method: "GET",
          url: "http://localhost/api/v1/pages/S33",
          headers: new Headers(),
          body: undefined,
        });
        expect(result.kind).toBe("json");
        if (result.kind !== "json") throw new Error("没有返回设置数据");
        const parsed = parser.safeParse(result.body);
        expect(parsed.success, String(parsed.error)).toBe(true);
        const data = result.body as { groups: { fields: { kind: string; value: string; options: { value: string }[] }[] }[] };
        for (const field of data.groups.flatMap((group) => group.fields).filter((field) => field.kind === "select")) {
          expect(field.options.some((option) => option.value === field.value)).toBe(true);
        }
      }
    }
  });
  it("查询状态映射、离线旧值和重试不吞掉权限错误", () => {
    const query = { data: undefined, error: null, status: "pending" as const, fetchStatus: "fetching" as const };
    expect(settingsView(query).state).toBe("loading");
    expect(settingsView({ ...query, status: "error", error: new Error("offline") }).state).toBe("offline");
    expect(settingsView({ ...query, status: "error", error: new ApiError("COMMON_FORBIDDEN") }).state).toBe("restricted");
    expect(settingsView({ ...query, status: "error", error: new ApiError("COMMON_INTERNAL") }).state).toBe("error");
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
    expect(shouldRetry(0, new Error("offline"))).toBe(true);
    expect(shouldRetry(1, new Error("offline"))).toBe(false);
  });
});
