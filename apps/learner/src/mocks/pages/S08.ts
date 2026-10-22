// S08：只返回 fixture 的预计算业务数字；写权限尚未登记，页面不伪造计划写回。
import type { S08Report } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";
const files = import.meta.glob("../../../../../fixtures/pages/S08/*.json", { eager: true, import: "default" });
function report(ctx: MockContext, availability: S08Report["availability"] = "ready"): S08Report {
  const view = ctx.query.get("view");
  const period = view === "month" || view === "round" ? view : "week";
  const fixture = files[`../../../../../fixtures/pages/S08/${ctx.exam.profile.exam_id}.json`] as { views: Record<string, S08Report> };
  const value = structuredClone(fixture.views[period]);
  if (value === undefined) throw new Error("S08 fixture missing");
  value.availability = availability;
  if (availability === "empty" || availability === "insufficient_data") {
    value.summary = "";
    value.highlights = [];
    value.improvement = "";
    value.coach = "";
    value.choices = [];
    value.forecast_available = false;
    value.score_sources = [];
    value.comparison = [];
    value.methods = value.methods.map((method) => ({
      ...method,
      minutes: availability === "empty" ? 0 : method.key === "practice" ? 45 : 0,
      gains_per_hour: 0,
    }));
    value.metrics = {
      effective_minutes: availability === "empty" ? 0 : 45,
      tier_gains: 0,
      forecast_delta: 0,
      active_days: availability === "empty" ? 0 : 1,
    };
    value.rhythm = [];
    value.mastery = [];
    value.sample_count = availability === "empty" ? 0 : 3;
    value.mistakes = { new: availability === "empty" ? 0 : 2, graduated: 0, stubborn: 0 };
  }
  if (availability === "restricted") {
    value.coach = "";
    value.choices = value.choices.filter((choice) => !choice.ai_generated);
  }
  return value;
}
export const routes = [
  defineRoute("getS08Recap", (ctx) => report(ctx), {
    variants: {
      empty: (ctx) => report(ctx, "empty"),
      restricted: (ctx) => report(ctx, "restricted"),
      insufficient_data: (ctx) => report(ctx, "insufficient_data"),
    },
  }),
];
