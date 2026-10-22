import { activeExamKey } from "./components/cache.ts";
import { reviewQuestions } from "./components/review.ts";
import { describe, expect, it } from "vitest";
import { ApiError, type S23AssessmentReport } from "@exam-prep/contract";
import * as validators from "@exam-prep/contract/zod";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { routes, reportFixture } from "../../mocks/pages/S23.ts";
import { reportView, shouldRetry, type ReportQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
const parser = (validators as Record<string, unknown>)["getAssessmentReportResponse"] as Parser;
const fixtures = loadDemoFixtures();
const normal = reportFixture("junior-accounting");
const query = (patch: Partial<ReportQuery> = {}): ReportQuery => ({
  data: undefined,
  error: null,
  status: "pending",
  fetchStatus: "fetching",
  ...patch,
});

describe("S23 测评报告数据契约", () => {
  it("四个演示考试与三种数据变体都通过生成的 Zod，受限保留暂定总分，样本不足隐藏百分位", async () => {
    for (const state of ["normal", "empty", "restricted", "insufficient_data"]) {
      const control = new DevControl({
        examKeys: fixtures.exams.map((e) => e.key),
        defaultExamKey: fixtures.defaultKey,
        search: () => `?state=${state}`,
      });
      const api = createMockApi({ db: new MockDb(fixtures), control, routes });
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const result = await api.handle({
          method: "GET",
          url: "http://localhost/api/v1/practice/reports/demo",
          headers: new Headers(),
          body: undefined,
        });
        expect(result.kind).toBe("json");
        if (result.kind !== "json") throw new Error("没有报告响应");
        expect(result.status).toBe(200);
        const parsed = parser.safeParse(result.body);
        expect(parsed.success, String(parsed.error)).toBe(true);
        const data = result.body as S23AssessmentReport;
        expect(data.exam_id).toBe(exam.examId);
        if (state === "empty") expect(data.available).toBe(false);
        if (state === "restricted") {
          expect(data.pending_grading).toBeGreaterThan(0);
          expect(data.questions.some((q) => q.pending_grading && q.correct === null)).toBe(true);
        }
        if (state === "insufficient_data") expect(data.summary.rank_visible).toBe(false);
      }
    }
  });
  it("取演示报告不会改写原始 fixture", () => {
    const data = reportFixture("junior-accounting");
    data.summary.score = 0;
    expect(reportFixture("junior-accounting").summary.score).toBe(normal.summary.score);
  });
});
describe("S23 请求状态映射与重试", () => {
  it("加载、空、出错、受限与正常来自请求结果", () => {
    expect(reportView(query()).state).toBe("loading");
    expect(reportView(query({ status: "success", data: normal })).state).toBe("normal");
    expect(reportView(query({ status: "success", data: { ...normal, available: false } })).state).toBe("empty");
    expect(reportView(query({ status: "error", error: new ApiError("COMMON_INTERNAL") })).state).toBe("error");
    expect(reportView(query({ status: "error", error: new ApiError("COMMON_FORBIDDEN") })).state).toBe("restricted");
  });
  it("离线显示缓存的已生成报告，不伪造新结果", () => {
    const failed = query({ status: "error", fetchStatus: "idle", error: new TypeError("network") });
    expect(reportView(failed)).toEqual({ state: "offline", data: undefined });
    expect(reportView(failed, normal)).toEqual({ state: "offline", data: normal });
    expect(reportView(query({ fetchStatus: "paused", data: normal })).state).toBe("offline");
  });
  it("主观题未评分、样本不足都只限制局部，完整报告仍可读", () => {
    expect(reportView(query({ status: "success", data: { ...normal, pending_grading: 1 } })).state).toBe("normal");
    expect(reportView(query({ status: "success", data: { ...normal, summary: { ...normal.summary, rank_visible: false } } })).state).toBe(
      "normal",
    );
  });
  it("网络或服务异常只重试一次，权限错误不重试", () => {
    expect(shouldRetry(0, new TypeError("network"))).toBe(true);
    expect(shouldRetry(1, new TypeError("network"))).toBe(false);
    expect(shouldRetry(0, new ApiError("COMMON_INTERNAL"))).toBe(true);
    expect(shouldRetry(0, new ApiError("COMMON_FORBIDDEN"))).toBe(false);
  });
});

describe("S23 复盘题目筛选", () => {
  it("未筛选时显示原题，指定空集合时不能显示全部题目", () => {
    expect(reviewQuestions(normal.questions)).toEqual(normal.questions);
    expect(reviewQuestions(normal.questions, [])).toEqual([]);
    expect(reviewQuestions(normal.questions, [normal.questions[0]!.id])).toEqual([normal.questions[0]]);
  });
});

describe("S23 开发考试缓存上下文", () => {
  it("工具条的新选择优先于初次进入时的地址", () => {
    expect(activeExamKey("?exam=kj", "en")).toBe("en");
  });
});
