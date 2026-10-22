// S19 的只读演示数据：所有页面业务数字由接口给，当前不是实际规则运算结果。
// feat:S19-01 自动收录来源不含摸底诊断；写操作待权限与后端接入后再实现。
import { ApiError, type S19Notebook } from "@exam-prep/contract";
import { param } from "@exam-prep/params";
import { defineRoute, type MockContext } from "../route.ts";

interface S19Fixture {
  readonly normal: S19Notebook;
  readonly insufficient_sample_count: number;
}

type Mode = "normal" | "empty" | "restricted" | "insufficient_data";
const FILES = import.meta.glob("../../../../../fixtures/pages/S19/*.json", { eager: true, import: "default" });

function notebook(ctx: MockContext, mode: Mode): S19Notebook {
  const found = Object.entries(FILES).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`));
  if (found === undefined) throw new ApiError("COMMON_NOT_FOUND", { exam_id: ctx.exam.examId });
  const fixture = found[1] as S19Fixture;
  const data = structuredClone(fixture.normal);
  // feat:S19-05 毕业说明读现有参数；不在本页实现毕业状态计算。
  data.graduation.correct_times = param("practice.mistake.graduate_correct_count");
  const firstInterval = param("practice.mistake.review_intervals")[0];
  if (firstInterval === undefined) throw new Error("错题回炉间隔参数不能为空");
  data.graduation.interval_days = firstInterval;
  data.graduation.fallback_correct_times =
    param("practice.mistake.graduate_correct_count") + param("practice.mistake.no_variant_extra_count");
  if (mode === "empty") {
    data.items = [];
    data.stats = { total: 0, today: 0, stubborn: 0, graduated: 0 };
    data.insights = { ...data.insights, available: false, sample_count: 0, clusters: [], root_points: [], traps: [], causes: [] };
  }
  if (mode === "restricted") {
    data.insights = { ...data.insights, restricted: true, clusters: [], root_points: [], traps: [], causes: [] };
  }
  if (mode === "insufficient_data") {
    data.insights = {
      ...data.insights,
      available: false,
      sample_count: fixture.insufficient_sample_count,
      clusters: [],
      root_points: [],
      traps: [],
      causes: [],
    };
  }
  return data;
}

export const routes = [
  defineRoute("getS19Notebook", (ctx) => notebook(ctx, "normal"), {
    variants: {
      empty: (ctx) => notebook(ctx, "empty"),
      restricted: (ctx) => notebook(ctx, "restricted"),
      insufficient_data: (ctx) => notebook(ctx, "insufficient_data"),
    },
  }),
];
