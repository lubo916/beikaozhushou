// S24 进度与预测的假数据（api-rules 第 3、4 节）。预测、完成度、健康度等规则还没实现（R06 由 B11 实现），
// 业务数字一律取 fixtures/pages/S24/<考试 ID>.json，整份标 data_source: sample。
// 考试之间的差异只在数据里（红线 1）：各考试 ?state= 场景要替换的取值写在同一个 fixture 的 scenarios 里，这里不按考试写分支。
// ?state= 的空、受限（含锁定）、数据不足由下面的 variants 给数据；加载、出错、离线由接口层统一处理（mocks/api.ts）。
import type { S24Forecast, S24Progress } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

type Mode = "normal" | "empty" | "restricted" | "insufficient_data";

/** 数据不足时的区间两端（R06 例子 E2：证据不足只让区间变宽，最可能值不变）。 */
interface RangeFixture {
  readonly conservative: number;
  readonly optimistic: number;
  readonly estimated_score_ratio?: number;
}

interface InsufficientFixture {
  readonly evidence_count: number;
  readonly health_sample?: { readonly observed_days: number; readonly advanced_levels: number };
  readonly importance_estimated?: boolean;
  readonly forecasts?: { readonly today?: RangeFixture; readonly target?: RangeFixture };
}

interface ScenarioFixture {
  readonly insufficient_data?: InsufficientFixture;
  readonly restricted?: { readonly blocked_reasons: readonly string[] };
}

/** fixtures/pages/S24/<考试 ID>.json：正常时的接口响应，加上 scenarios（只给假数据层用，不随响应下发）。 */
type PageFixture = S24Progress & { readonly scenarios?: ScenarioFixture };

const FILES = import.meta.glob<PageFixture>("../../../../../fixtures/pages/S24/*.json", { eager: true, import: "default" });

function pageFixture(ctx: MockContext): PageFixture {
  const entry = Object.entries(FILES).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`));
  if (entry === undefined) throw new Error(`演示考试 ${ctx.exam.examId} 缺少 fixtures/pages/S24 的进度数据`);
  return structuredClone(entry[1]);
}

/** 地图体检不通过（R06 R12、S24-07）：预测、差额、走势、分值地图、阶梯、推荐路径、差距分解与各科差额都不下发；完成度、健康度照常。 */
function locked(data: S24Progress, reasons: readonly string[]): S24Progress {
  return {
    ...data,
    map_check: "blocked",
    blocked_reasons: data.blocked_reasons.length > 0 ? data.blocked_reasons : [...reasons],
    forecasts: {},
    trend: [],
    score_bands: [],
    points: [],
    path: [],
    gaps: [],
    subjects: data.subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      completion: subject.completion,
      passed: false,
      actual_minutes: subject.actual_minutes,
      suggested_minutes: subject.suggested_minutes,
    })),
  };
}

function widen(forecast: S24Forecast, range: RangeFixture | undefined): S24Forecast {
  if (range === undefined) return { ...forecast, confidence: "low", low_confidence: true };
  return {
    ...forecast,
    conservative: range.conservative,
    optimistic: range.optimistic,
    confidence: "low",
    estimated_score_ratio: range.estimated_score_ratio ?? forecast.estimated_score_ratio,
    low_confidence: true,
  };
}

/** 证据不足（R06 R7、R11）：区间换成 fixture 给的更宽的两端并标低置信；走势的最后一天就是“今天”，跟着换。 */
function insufficient(data: S24Progress, scenario: InsufficientFixture | undefined): S24Progress {
  const forecasts = { ...data.forecasts };
  if (forecasts.today !== undefined) forecasts.today = widen(forecasts.today, scenario?.forecasts?.today);
  if (forecasts.target !== undefined) forecasts.target = widen(forecasts.target, scenario?.forecasts?.target);
  const today = forecasts.today;
  const last = data.trend.length - 1;
  const trend =
    today === undefined
      ? data.trend
      : data.trend.map((row, index) => (index === last ? { ...row, conservative: today.conservative, optimistic: today.optimistic } : row));
  const metrics =
    scenario?.health_sample === undefined
      ? data.metrics
      : {
          workload: data.metrics.workload,
          weighted: data.metrics.weighted,
          health_state: "insufficient_data" as const,
          ...scenario.health_sample,
        };
  return {
    ...data,
    evidence_count: scenario?.evidence_count ?? data.evidence_count,
    importance_estimated: scenario?.importance_estimated ?? data.importance_estimated,
    metrics,
    forecasts,
    trend,
  };
}

function progress(ctx: MockContext, mode: Mode): S24Progress {
  const { scenarios, ...data } = pageFixture(ctx);
  if (mode === "empty") return { ...data, has_progress: false };
  if (mode === "restricted" || data.map_check === "blocked") return locked(data, scenarios?.restricted?.blocked_reasons ?? []);
  if (mode === "insufficient_data") return insufficient(data, scenarios?.insufficient_data);
  return data;
}

export const routes = [
  defineRoute("getS24Progress", (ctx) => progress(ctx, "normal"), {
    variants: {
      empty: (ctx) => progress(ctx, "empty"),
      restricted: (ctx) => progress(ctx, "restricted"),
      locked: (ctx) => progress(ctx, "restricted"),
      insufficient_data: (ctx) => progress(ctx, "insufficient_data"),
    },
  }),
];
