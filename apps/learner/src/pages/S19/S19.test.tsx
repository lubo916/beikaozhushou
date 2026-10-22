// S19 假数据契约测试；界面交互与各视图由本页 E2E 覆盖。
import { afterEach, describe, expect, it } from "vitest";
import { ApiError, type S19Notebook } from "@exam-prep/contract";
import * as zodSchemas from "@exam-prep/contract/zod";
import { param, setParamSource } from "@exam-prep/params";
import { createMockApi } from "../../mocks/api.ts";
import { DevControl } from "../../mocks/control.ts";
import { MockDb } from "../../mocks/db.ts";
import { loadDemoFixtures } from "../../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../../mocks/registry.ts";
import { notebookView, type NotebookQuery } from "./data.ts";

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}
interface Fixture {
  readonly normal: S19Notebook;
  readonly insufficient_sample_count: number;
}

const PAGE_FIXTURES = import.meta.glob("../../../../../fixtures/pages/S19/*.json", { eager: true, import: "default" });
const fixtures = loadDemoFixtures();
const routes = collectRoutes(loadRouteModules());
const parser = (zodSchemas as Record<string, unknown>)["getS19NotebookResponse"] as Parser | undefined;
const NOW = Date.parse("2026-10-22T02:00:00Z");
const CAUSES = ["not_learned", "forgot", "concept_unclear", "method_unknown", "misread", "slip", "time_short"];
const SOURCES = ["practice", "mock_exam", "in_class", "photo", "import", "manual"];

function setup(state = "") {
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => (state === "" ? "" : `?state=${state}`),
    clock: () => NOW,
  });
  const api = createMockApi({ db: new MockDb(fixtures), control, routes });
  async function notebook(): Promise<S19Notebook> {
    const result = await api.handle({
      method: "GET",
      url: "http://localhost/api/v1/learner/mistake-notebook",
      headers: new Headers(),
      body: undefined,
    });
    expect(result.kind).toBe("json");
    if (result.kind !== "json") throw new Error("错题本接口没有返回 JSON");
    expect(result.status).toBe(200);
    const parsed = parser?.safeParse(result.body);
    expect(parsed?.success, String(parsed?.error)).toBe(true);
    return result.body as S19Notebook;
  }
  return { control, notebook };
}

afterEach(() => setParamSource(() => undefined));

describe("S19 错题本契约与四考试假数据", () => {
  it("四份页面 fixture 都通过生成的响应 Zod，题干与知识点属于对应考试", () => {
    expect(typeof parser?.safeParse).toBe("function");
    expect(Object.keys(PAGE_FIXTURES)).toHaveLength(4);
    for (const [path, value] of Object.entries(PAGE_FIXTURES)) {
      const fixture = value as Fixture;
      const parsed = parser?.safeParse(fixture.normal);
      expect(parsed?.success, `${path}: ${String(parsed?.error)}`).toBe(true);
      const exam = fixtures.exams.find((entry) => path.endsWith(`/${entry.examId}.json`));
      expect(exam).toBeDefined();
      for (const row of fixture.normal.items) {
        const question = exam?.questions.find((entry) => entry.id === row.mistake.question_id);
        expect(question?.stem).toBe(row.stem);
        expect(row.mistake.exam_id).toBe(exam?.examId);
        expect(row.mistake.knowledge_point_ids).toEqual(question?.knowledge_point_ids);
      }
    }
  });

  it("四考试正常、空、受限、数据不足都经 MSW 路由返回合约内的示例数据", async () => {
    for (const mode of ["", "empty", "restricted", "insufficient_data"]) {
      const { control, notebook } = setup(mode);
      for (const exam of fixtures.exams) {
        control.setExam(exam.key);
        const data = await notebook();
        expect(data.data_source).toBe("sample");
        if (mode === "empty") {
          expect(data.items).toEqual([]);
          expect(data.stats.today).toBe(0);
          expect(data.insights.available).toBe(false);
        } else {
          expect(data.items.length).toBeGreaterThan(0);
        }
        if (mode === "restricted") {
          expect(data.insights.restricted).toBe(true);
          expect(data.insights.clusters).toEqual([]);
        }
        if (mode === "insufficient_data") {
          expect(data.insights.available).toBe(false);
          expect(data.insights.sample_count).toBeLessThan(data.insights.minimum_count);
          expect(data.insights.clusters).toEqual([]);
          expect(data.insights.traps).toEqual([]);
        }
      }
    }
  });

  it("数据不足态的收录总数与聚类样本计数一致", async () => {
    const { control, notebook } = setup("insufficient_data");
    for (const exam of fixtures.exams) {
      control.setExam(exam.key);
      const data = await notebook();
      expect(data.stats.total).toBe(data.insights.sample_count);
      for (const count of [data.stats.today, data.stats.stubborn, data.stats.graduated])
        expect(count).toBeLessThanOrEqual(data.stats.total);
    }
  });

  it("四状态与顽固标签分开，来源不含摸底诊断，错因只用统一七类", async () => {
    const { control, notebook } = setup();
    for (const exam of fixtures.exams) {
      control.setExam(exam.key);
      const data = await notebook();
      expect(new Set(data.items.map((row) => row.mistake.status))).toEqual(new Set(["new", "retrying", "awaiting_check", "graduated"]));
      for (const row of data.items) {
        expect(CAUSES).toContain(row.cause_code);
        expect(SOURCES).toContain(row.source);
      }
      expect(data.items.some((row) => row.mistake.tags.includes("stubborn"))).toBe(true);
      expect(new Set(data.insights.causes.map((row) => row.code))).toEqual(new Set(CAUSES));
    }
  });

  it("毕业说明由参数访问器取值，参数变化会传到接口而不是固定在页面里", async () => {
    setParamSource((name) => {
      if (name === "practice.mistake.graduate_correct_count") return 4;
      if (name === "practice.mistake.no_variant_extra_count") return 2;
      if (name === "practice.mistake.review_intervals") return [5, 10, 15];
      return undefined;
    });
    const data = await setup().notebook();
    expect(data.graduation.correct_times).toBe(param("practice.mistake.graduate_correct_count"));
    expect(data.graduation.interval_days).toBe(5);
    expect(data.graduation.fallback_correct_times).toBe(6);
  });
});

describe("S19 七态判断仅依据接口结果", () => {
  const waiting: NotebookQuery = { data: undefined, error: null, status: "pending", fetchStatus: "fetching" };
  const failed = (error: unknown): NotebookQuery => ({ data: undefined, error, status: "error", fetchStatus: "idle" });
  function sample(): S19Notebook {
    const fixture = Object.values(PAGE_FIXTURES)[0] as Fixture | undefined;
    if (fixture === undefined) throw new Error("错题本缺少页面示例");
    return structuredClone(fixture.normal);
  }
  const success = (data: S19Notebook): NotebookQuery => ({ data, error: null, status: "success", fetchStatus: "idle" });

  it("请求挂起显示加载，取到有错题的数据显示正常，取到空列表显示空态", () => {
    expect(notebookView(waiting).state).toBe("loading");
    expect(notebookView(success(sample())).state).toBe("normal");
    expect(notebookView(success({ ...sample(), items: [] })).state).toBe("empty");
  });

  it("接口回 500 显示出错，请求没有网络回应或查询暂停显示离线", () => {
    expect(notebookView(failed(new ApiError("COMMON_INTERNAL"))).state).toBe("error");
    expect(notebookView(failed(new TypeError("Failed to fetch"))).state).toBe("offline");
    expect(notebookView({ ...waiting, fetchStatus: "paused" }).state).toBe("offline");
  });

  it("已有数据时断网仍保留错题内容，同时显示离线提示", () => {
    const data = sample();
    const networkError = notebookView({ ...failed(new TypeError("Failed to fetch")), data });
    expect(networkError.state).toBe("normal");
    expect(networkError.data).toBe(data);
    expect(networkError.stale).toBe(true);
    const paused = notebookView({ ...success(data), fetchStatus: "paused" });
    expect(paused.state).toBe("normal");
    expect(paused.stale).toBe(true);
  });

  it("AI 受限与样本不足只限制洞察，主内容仍保持正常显示", () => {
    const data = sample();
    const restricted = { ...data, insights: { ...data.insights, restricted: true } };
    const insufficient = { ...data, insights: { ...data.insights, available: false } };
    expect(notebookView(success(restricted))).toEqual({ state: "normal", data: restricted, stale: false });
    expect(notebookView(success(insufficient))).toEqual({ state: "normal", data: insufficient, stale: false });
  });
});
