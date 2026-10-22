import { describe, expect, it } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import * as zod from "@exam-prep/contract/zod";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { progressView, shouldRetry } from "./data.ts";
import type { S24Progress } from "@exam-prep/contract";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const parser = (zod as Record<string, unknown>)["getS24ProgressResponse"] as Parser;
const fixtures = loadDemoFixtures();
async function load(exam: string, state = ""): Promise<S24Progress> {
  const control = new DevControl({
    examKeys: fixtures.exams.map((e) => e.key),
    defaultExamKey: exam,
    search: () => "?exam=" + exam + "&state=" + state,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes: collectRoutes(loadRouteModules()) });
  const result = await api.handle({ method: "GET", url: "http://localhost/api/v1/learner/progress", headers: new Headers() });
  expect(result.kind).toBe("json");
  if (result.kind !== "json") throw new Error("没有进度数据");
  expect(result.status).toBe(200);
  const parsed = parser.safeParse(result.body);
  expect(parsed.success, String(parsed.error)).toBe(true);
  return result.body as S24Progress;
}
describe("S24 契约与七态", () => {
  it("四个考试的全部数据变体通过生成的 Zod", async () => {
    for (const exam of fixtures.exams) for (const state of ["", "empty", "restricted", "insufficient_data"]) await load(exam.key, state);
  });
  it("地图阻断时接口移除预测、分值地图与阶梯，三个数中的完成度和健康度仍在", async () => {
    for (const [exam, state] of [
      ["kj", "restricted"],
      ["ds", ""],
    ] as const) {
      const data = await load(exam, state);
      expect(data.map_check).toBe("blocked");
      expect(data.forecasts).toEqual({});
      expect(data.points).toEqual([]);
      expect(data.path).toEqual([]);
      expect(data.score_bands).toEqual([]);
      expect(data.trend).toEqual([]);
      expect(data.metrics.workload).toBeGreaterThan(0);
      expect(data.metrics.health).toBeGreaterThan(0);
    }
  });
  it("证据不足有低置信标记且区间加宽", async () => {
    const normal = await load("kj");
    const low = await load("kj", "insufficient_data");
    expect(low.forecasts.today?.low_confidence).toBe(true);
    expect(low.forecasts.today?.conservative).toBeLessThan(normal.forecasts.today?.conservative ?? 0);
    expect(low.forecasts.today?.optimistic).toBeGreaterThan(normal.forecasts.today?.optimistic ?? 0);
  });
  it("空态由 has_progress 判断，加载、出错、离线按请求结果判断", async () => {
    const base = { status: "pending" as const, fetchStatus: "fetching" as const, error: null };
    expect(progressView(base).state).toBe("loading");
    expect(progressView({ ...base, status: "error", error: new ApiError("COMMON_INTERNAL") }).state).toBe("error");
    expect(progressView({ ...base, fetchStatus: "paused" }).state).toBe("offline");
    expect(progressView({ ...base, status: "success", data: await load("kj", "empty") }).state).toBe("empty");
  });
  it("离线保留接口旧结果及其原计算时间", async () => {
    const data = await load("kj");
    const result = progressView({ status: "error", fetchStatus: "idle", error: new TypeError("offline") }, data);
    expect(result.state).toBe("normal");
    expect(result.stale).toBe(true);
    expect(result.data?.computed_at).toBe(data.computed_at);
  });
  it("仅网络及服务异常重试一次，权限错误不重试", () => {
    expect(shouldRetry(0, new TypeError("offline"))).toBe(true);
    expect(shouldRetry(1, new TypeError("offline"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});
