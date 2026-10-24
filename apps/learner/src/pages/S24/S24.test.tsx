import { describe, expect, it } from "vitest";
import { ApiError } from "@exam-prep/contract/errors";
import * as zod from "@exam-prep/contract/zod";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import {
  CURRENT_SLOT,
  PROGRESS_CACHE_PREFIX,
  progressSlot,
  progressView,
  readCachedProgress,
  shouldRetry,
  writeCachedProgress,
  type CacheStore,
} from "./data.ts";
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
  // GET 没有请求体：与 MSW 接线（mock-browser 的 readBody）一致，显式传 undefined。
  const result = await api.handle({
    method: "GET",
    url: "http://localhost/api/v1/learner/progress",
    headers: new Headers(),
    body: undefined,
  });
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

/** 考试画像里本页要核对的两项（ProfileFixture 只登记了公共字段）。 */
interface ProfileShape {
  readonly full_score: number;
  readonly structure: readonly { readonly subject: string }[];
}

const profileOf = (exam: (typeof fixtures.exams)[number]): ProfileShape => exam.profile as unknown as ProfileShape;

describe("S24 示例数据口径（R06：目标线是学员自己的目标分，差额＝目标分 − 最可能值）", () => {
  it("四个考试的目标线、差额、区间、走势、科目、分值四段、当前档与考试画像和学员数据一致", async () => {
    for (const exam of fixtures.exams) {
      const data = await load(exam.key);
      const profile = profileOf(exam);
      expect(data.exam_id).toBe(exam.examId);
      expect(
        data.subjects.map((s) => s.name),
        exam.key,
      ).toEqual(profile.structure.map((s) => s.subject));
      for (const forecast of [data.forecasts.today, data.forecasts.target]) {
        if (forecast === undefined) continue;
        expect(forecast.target_line, exam.key).toBe(exam.learner.goal.target_score);
        expect(forecast.gap, exam.key).toBe(forecast.target_line - forecast.likely);
        expect(forecast.conservative).toBeLessThanOrEqual(forecast.likely);
        expect(forecast.likely).toBeLessThanOrEqual(forecast.optimistic);
        expect(forecast.conservative).toBeGreaterThanOrEqual(0);
        expect(forecast.optimistic).toBeLessThanOrEqual(profile.full_score);
      }
      const today = data.forecasts.today;
      const last = data.trend.at(-1);
      if (today !== undefined)
        expect(last && [last.conservative, last.likely, last.optimistic]).toEqual([today.conservative, today.likely, today.optimistic]);
      if (data.score_bands.length > 0) expect(data.score_bands.reduce((sum, band) => sum + band.score, 0)).toBe(profile.full_score);
      for (const subject of data.subjects) if (subject.gap !== undefined) expect(subject.passed).toBe(subject.gap <= 0);
      const levels = new Map(exam.learner.mastery.map((m) => [m.knowledge_point_id, m.level]));
      for (const point of [...data.points, ...data.path]) expect(point.current_level, point.name).toBe(levels.get(point.id));
    }
  });

  it("每科都要过的考试写出头部是差距最大的一科；只有一科的考试不写科目名（R06 R4）", async () => {
    for (const exam of fixtures.exams) {
      const data = await load(exam.key);
      if (profileOf(exam).structure.length > 1) {
        const widest = [...data.subjects].sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0];
        expect(data.headline_subject, exam.key).toBe(widest?.name);
      } else {
        expect(data.headline_subject, exam.key).toBeUndefined();
      }
    }
  });

  it("数据不足：四个考试都只加宽区间、最可能值不变，并标低置信（R06 E2）", async () => {
    for (const exam of fixtures.exams) {
      const normal = await load(exam.key);
      const low = await load(exam.key, "insufficient_data");
      if (normal.map_check === "blocked") {
        expect(low.map_check, exam.key).toBe("blocked");
        expect(low.forecasts).toEqual({});
        continue;
      }
      for (const at of ["today", "target"] as const) {
        const before = normal.forecasts[at];
        const after = low.forecasts[at];
        expect(before, exam.key + at).toBeDefined();
        if (before === undefined) continue;
        expect(after?.likely, exam.key + at).toBe(before.likely);
        expect(after?.low_confidence).toBe(true);
        expect(after?.conservative).toBeLessThan(before.conservative);
        expect(after?.optimistic).toBeGreaterThan(before.optimistic);
        expect(after?.optimistic).toBeLessThanOrEqual(profileOf(exam).full_score);
      }
      expect(low.evidence_count, exam.key).toBeLessThan(normal.evidence_count);
    }
  });

  it("地图阻断时差距分解与各科差额也不下发，各科不标已过目标线，并写明原因", async () => {
    for (const [exam, state] of [
      ["kj", "restricted"],
      ["ds", ""],
    ] as const) {
      const data = await load(exam, state);
      expect(data.gaps).toEqual([]);
      expect(data.blocked_reasons.length).toBeGreaterThan(0);
      for (const subject of data.subjects) {
        expect(subject.gap).toBeUndefined();
        expect(subject.passed).toBe(false);
      }
    }
  });
});

describe("S24 离线缓存（R06：离线只显示上次的结果和计算时间）", () => {
  function memoryStore(): CacheStore & { readonly map: Map<string, string> } {
    const map = new Map<string, string>();
    return {
      map,
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => {
        map.set(key, value);
      },
      removeItem: (key) => {
        map.delete(key);
      },
    };
  }

  it("地址没写考试时用单独的格子，不冒充默认考试", () => {
    expect(progressSlot(new URLSearchParams(""))).toBe(CURRENT_SLOT);
    expect(progressSlot(new URLSearchParams("exam=en"))).toBe("en");
    expect(CURRENT_SLOT).not.toBe(fixtures.defaultKey);
  });

  it("缓存按真实考试身份读取：初级会计不冒充六级或未确认目标，计算时间不变", async () => {
    const store = memoryStore();
    const kj = await load("kj");
    writeCachedProgress("kj", kj, store);
    expect(readCachedProgress(kj.exam_id, store)?.computed_at).toBe(kj.computed_at);
    expect(readCachedProgress(kj.exam_id, store)?.exam_id).toBe(kj.exam_id);
    expect(readCachedProgress("en", store)).toBeUndefined();
    expect(readCachedProgress(CURRENT_SLOT, store)).toBeUndefined();
    expect(readCachedProgress(CURRENT_SLOT, store, kj.exam_id)?.computed_at).toBe(kj.computed_at);
  });

  it("缓存损坏或是旧版本时丢掉，回到没有缓存的离线态", async () => {
    const store = memoryStore();
    store.setItem(PROGRESS_CACHE_PREFIX + "kj", "{坏掉的缓存");
    expect(readCachedProgress("kj", store)).toBeUndefined();
    expect(store.map.has(PROGRESS_CACHE_PREFIX + "kj")).toBe(false);
    const kj = await load("kj");
    store.setItem(PROGRESS_CACHE_PREFIX + "en", JSON.stringify({ ...kj, metrics: { ...kj.metrics, verdict: "steady" } }));
    expect(readCachedProgress("en", store)).toBeUndefined();
    const offline = { status: "error" as const, fetchStatus: "idle" as const, error: new TypeError("offline") };
    expect(progressView(offline, readCachedProgress("en", store)).state).toBe("offline");
  });
});

describe("S24 本地补全回归", () => {
  it("健康度样本不足时只给原始推进记录，不返回比值、判词或速度", async () => {
    const low = await load("kj", "insufficient_data");
    expect(low.metrics).toMatchObject({ health_state: "insufficient_data", observed_days: 4, advanced_levels: 3 });
    expect(low.metrics.health).toBeUndefined();
    expect(low.metrics.verdict).toBeUndefined();
    expect(low.metrics.recent_daily).toBeUndefined();
    expect(low.metrics.required_daily).toBeUndefined();
  });
  it("预测携带置信度、估计分值占比和可用的较上周变化，并单列合格线", async () => {
    const normal = await load("kj");
    const low = await load("kj", "insufficient_data");
    expect(normal.forecasts.today).toMatchObject({ confidence: "medium", estimated_score_ratio: 0, weekly_change: 2 });
    expect(low.forecasts.today).toMatchObject({ confidence: "low", estimated_score_ratio: 0.7 });
    expect(normal).toHaveProperty("qualification_line", 60);
    expect(normal.forecasts.today?.target_line).toBe(70);
    const previousWeek = normal.trend.filter((row) => row.day < "2026-10-19").at(-1);
    if (previousWeek === undefined) throw new Error("示例缺少上周的历史记录");
    expect(normal.forecasts.today?.weekly_change).toBe((normal.forecasts.today?.likely ?? 0) - previousWeek.likely);
  });
});
