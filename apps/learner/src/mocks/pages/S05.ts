// S05 业务数字来自 fixture；页面只显示接口结果。
import type { S05StartReport } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";
interface Fixture {
  readonly report: S05StartReport;
  readonly quick_forecast: NonNullable<S05StartReport["forecast"]>;
  readonly quick_evidence_count: number;
  readonly locked_repairs: S05StartReport["repairs"];
}
const FILES = import.meta.glob("../../../../../fixtures/pages/S05/*.json", { eager: true, import: "default" });
export function startReport(ctx: MockContext, mode = "normal"): S05StartReport {
  const found = Object.entries(FILES).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`));
  if (found === undefined) throw new Error(`S05 缺少考试示例：${ctx.exam.examId}`);
  const fixture = found[1] as Fixture;
  const quick = mode === "insufficient_data" || ctx.params["view"] === "quick";
  const report: S05StartReport = {
    ...structuredClone(fixture.report),
    viewer_id: ctx.db.fixtures.learner.id,
    exam_id: ctx.exam.examId,
    demo_exam_key: ctx.exam.key,
    target_date: ctx.exam.learner.goal.target_date,
    target_score: ctx.exam.learner.goal.target_score,
    exam_name: ctx.exam.profile.name,
    available: mode !== "empty",
    guest: mode === "restricted" || fixture.report.guest,
    view: quick ? "quick" : "normal",
    evidence_count: quick ? fixture.quick_evidence_count : fixture.report.evidence_count,
    ...(quick ? { forecast: fixture.quick_forecast } : {}),
  };
  // feat:S05-10 地图阻断项没有修复时，不交付预测字段。
  if (mode === "locked") {
    report.map_health = "blocked";
    report.repairs = structuredClone(fixture.locked_repairs);
  }
  if (report.map_health === "blocked") delete report.forecast;
  return report;
}
export const routes = [
  defineRoute("getStartReport", (ctx) => startReport(ctx), {
    variants: {
      empty: (ctx) => startReport(ctx, "empty"),
      restricted: (ctx) => startReport(ctx, "restricted"),
      insufficient_data: (ctx) => startReport(ctx, "insufficient_data"),
      locked: (ctx) => startReport(ctx, "locked"),
    },
  }),
];
