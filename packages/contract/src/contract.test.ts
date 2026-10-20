import { describe, expect, it } from "vitest";
import index from "../../../fixtures/exams/index.json";
import enLearner from "../../../fixtures/exams/cet-6/learner.json";
import enMap from "../../../fixtures/exams/cet-6/knowledge-map.json";
import enProfile from "../../../fixtures/exams/cet-6/profile.json";
import enQuestions from "../../../fixtures/exams/cet-6/questions.json";
import dsLearner from "../../../fixtures/exams/ds-final-custom/learner.json";
import dsMap from "../../../fixtures/exams/ds-final-custom/knowledge-map.json";
import dsProfile from "../../../fixtures/exams/ds-final-custom/profile.json";
import dsQuestions from "../../../fixtures/exams/ds-final-custom/questions.json";
import kjLearner from "../../../fixtures/exams/junior-accounting/learner.json";
import kjMap from "../../../fixtures/exams/junior-accounting/knowledge-map.json";
import kjProfile from "../../../fixtures/exams/junior-accounting/profile.json";
import kjQuestions from "../../../fixtures/exams/junior-accounting/questions.json";
import jsLearner from "../../../fixtures/exams/teacher-qualification/learner.json";
import jsMap from "../../../fixtures/exams/teacher-qualification/knowledge-map.json";
import jsProfile from "../../../fixtures/exams/teacher-qualification/profile.json";
import jsQuestions from "../../../fixtures/exams/teacher-qualification/questions.json";
import { API_BASE_PATH } from "./fetcher.ts";
import * as zodSchemas from "./generated/api/endpoints.zod.ts";
import { API_PREFIX, OPERATIONS } from "./generated/operations.ts";
import { ContractError, mergeOpenapi, type ContractFile, type MergeOptions } from "./openapi-merge.ts";

// 生成的 Zod 结构按 operationId 命名（<operationId>Response）；按名字取，名字不对时测试失败并说清楚缺哪个。
const SCHEMAS: Record<string, unknown> = { ...zodSchemas };

interface Parser {
  safeParse(value: unknown): { success: boolean; error?: unknown };
}

function expectValid(name: string, value: unknown, label: string): void {
  const schema = SCHEMAS[name] as Partial<Parser> | undefined;
  expect(typeof schema?.safeParse, `生成的 Zod 结构里没有 ${name}`).toBe("function");
  const result = (schema as Parser).safeParse(value);
  expect(result.success, `${label} 不符合 ${name}：${String(result.error)}`).toBe(true);
}

const EXAMS = [
  { profile: kjProfile, map: kjMap, content: kjQuestions, learner: kjLearner },
  { profile: jsProfile, map: jsMap, content: jsQuestions, learner: jsLearner },
  { profile: enProfile, map: enMap, content: enQuestions, learner: enLearner },
  { profile: dsProfile, map: dsMap, content: dsQuestions, learner: dsLearner },
];

const SEGMENTS = ["consolidate", "advance", "closing"];
const SOLUTION_KEYS = [
  "answer",
  "explanation",
  "option_notes",
  "common_wrong_option",
  "group_miss_rate",
  "scoring_points",
  "sample_answer",
];
const OPTIONS: MergeOptions = {
  owners: ["exam", "plan"],
  actions: ["exam.profile.read", "plan.today.read"],
  errors: ["COMMON_NOT_FOUND"],
};
const COMMON: ContractFile = {
  path: "contracts/openapi/_common.yaml",
  doc: {
    openapi: "3.1.0",
    info: { title: "t", version: "1" },
    servers: [{ url: "/api/v1" }],
    components: { schemas: { Id: { type: "string" } } },
  },
};

function op(operationId: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const base = { operationId, "x-owner": "exam", "x-action": "exam.profile.read", responses: { "200": { description: "ok" } } };
  return { ...base, ...extra };
}

function problemsOf(files: ContractFile[]): string[] {
  try {
    mergeOpenapi(COMMON, files, OPTIONS);
  } catch (error) {
    if (error instanceof ContractError) return [...error.problems];
    throw error;
  }
  return [];
}

describe("接口契约合并（tools/merge-openapi.mjs，api-rules 第 2 节）", () => {
  it("分文件合成一份：路径、形状与接口一览都在", () => {
    const errors = { "x-errors": ["COMMON_NOT_FOUND"] };
    const files: ContractFile[] = [
      { path: "contracts/openapi/schemas/exam.yaml", doc: { components: { schemas: { Exam: { type: "object" } } } } },
      { path: "contracts/openapi/paths/exam.yaml", doc: { paths: { "/exams/{examId}": { get: op("getExam", errors) } } } },
    ];
    const result = mergeOpenapi(COMMON, files, OPTIONS);
    expect(result.basePath).toBe("/api/v1");
    expect(Object.keys(result.spec["paths"] as object)).toEqual(["/exams/{examId}"]);
    expect(result.operations.map((o) => [o.operationId, o.method, o.owner])).toEqual([["getExam", "GET", "exam"]]);
  });

  it("名字、路径或 operationId 重复直接报错，并说出两个文件", () => {
    const schema = { components: { schemas: { Exam: { type: "object" } } } };
    const problems = problemsOf([
      { path: "contracts/openapi/schemas/a.yaml", doc: schema },
      { path: "contracts/openapi/schemas/b.yaml", doc: schema },
      { path: "contracts/openapi/paths/a.yaml", doc: { paths: { "/a": { get: op("getA") } } } },
      { path: "contracts/openapi/paths/b.yaml", doc: { paths: { "/a": { post: op("postA") }, "/b": { get: op("getA") } } } },
    ]);
    expect(problems.some((p) => p.includes("形状名重复") && p.includes("a.yaml") && p.includes("b.yaml"))).toBe(true);
    expect(problems.some((p) => p.startsWith("路径重复：/a"))).toBe(true);
    expect(problems.some((p) => p.startsWith("operationId 重复：getA"))).toBe(true);
  });

  it("领域、权限动作、错误码、引用、x-invalidates 与页面私有形状的写法都受检查", () => {
    const extra = { "x-owner": "nope", "x-action": "nope.read", "x-errors": ["NOPE"], "x-invalidates": ["getY"] };
    const doc = {
      components: { schemas: { TodayView: { $ref: "#/components/schemas/Missing" } } },
      paths: { "/x": { get: op("getX", extra) } },
    };
    const problems = problemsOf([{ path: "contracts/openapi/pages/S06.yaml", doc }]);
    for (const hint of ["x-owner", "x-action", "x-errors", "x-invalidates", "找不到对应的形状", "要以页 ID S06 开头"]) {
      const found = problems.some((p) => p.includes(hint));
      expect(found, `应提示 ${hint}：${problems.join("；")}`).toBe(true);
    }
  });

  it("仓库里的契约已合并：前缀与请求函数一致，x-invalidates 指向已有接口", () => {
    expect(API_PREFIX).toBe(API_BASE_PATH);
    expect(OPERATIONS.getMeContext).toMatchObject({ method: "GET", path: "/me/context", owner: "account" });
    const known = Object.keys(OPERATIONS);
    for (const info of Object.values(OPERATIONS)) {
      for (const target of info.invalidates) expect(known).toContain(target);
    }
  });
});

describe("四个演示考试的数据（fixtures/exams/）", () => {
  it("切换键 kj/js/en/ds 对应四个考试目录（F04-Q1）", () => {
    expect(index.exams.map((e) => e.key)).toEqual(["kj", "js", "en", "ds"]);
    expect(index.exams.map((e) => e.exam_id)).toEqual(EXAMS.map((e) => e.profile.exam_id));
  });

  it("考试画像、知识地图、题目、答案与解析、卡片都通过生成的 Zod 校验", () => {
    for (const { profile, map, content } of EXAMS) {
      const exam = profile.exam_id;
      expectValid("getExamProfileResponse", profile, `${exam} 的考试画像`);
      expectValid("getKnowledgeMapResponse", map, `${exam} 的知识地图`);
      for (const question of content.questions) {
        expectValid("getQuestionResponse", { ...question, exam_id: exam }, `${exam} 的题目 ${question.id}`);
        const record: Record<string, unknown> = question;
        const present = SOLUTION_KEYS.filter((k) => record[k] !== undefined);
        const solution = Object.fromEntries(present.map((k) => [k, record[k]]));
        expectValid("getQuestionSolutionResponse", { question_id: question.id, ...solution }, `${exam} 的解析 ${question.id}`);
      }
      for (const card of content.cards) expectValid("getCardResponse", card, `${exam} 的卡片 ${card.id}`);
    }
  });

  it("示例学员状态（掌握方格、今日任务、计划、提议、笔记、资料、通知）通过生成的 Zod 校验", () => {
    for (const { profile, map, learner } of EXAMS) {
      const exam = profile.exam_id;
      const grid = { map_id: map.map_id, cells: learner.mastery, data_source: "sample" };
      expectValid("getMasteryGridResponse", grid, `${exam} 的掌握方格`);
      const tasks = learner.today_tasks.map((t) => ({ ...t, status: "todo", question_count: t.question_ids.length, answered_count: 0 }));
      const bySegment = (segment: string) => ({ segment, tasks: tasks.filter((t) => t.segment === segment) });
      const today = { day: "2026-10-21", exam_id: exam, segments: SEGMENTS.map(bySegment), data_source: "sample" };
      expectValid("getTodayListResponse", today, `${exam} 的今日任务`);
      expectValid("getCurrentPlanResponse", { ...learner.plan, data_source: "sample" }, `${exam} 的学习计划`);
      const pages: [string, unknown[]][] = [
        ["listProposalsResponse", learner.proposals],
        ["listNotesResponse", learner.notes],
        ["listMaterialsResponse", learner.materials],
        ["listNotificationsResponse", learner.notifications],
      ];
      for (const [name, items] of pages) expectValid(name, { items, next_cursor: null, data_source: "sample" }, `${exam} 的 ${name}`);
    }
  });

  it("数据彼此一致（勘误第 8 条）：引用的知识点都在地图里，题组名、题数与题目对得上", () => {
    for (const { profile, map, content, learner } of EXAMS) {
      const exam = profile.exam_id;
      const points = new Map(map.chapters.flatMap((c) => c.sample_points).map((p) => [p.id, p.name]));
      const questions = new Map(content.questions.map((q) => [q.id, q]));
      const refs = [
        ...content.questions.flatMap((q) => q.knowledge_point_ids),
        ...content.cards.map((c) => c.knowledge_point_id),
        ...learner.mastery.map((m) => m.knowledge_point_id),
        ...learner.notes.flatMap((n) => n.knowledge_point_ids),
        ...learner.materials.flatMap((m) => m.knowledge_point_ids),
      ];
      for (const id of refs) expect(points.has(id), `${exam} 引用的知识点 ${id}`).toBe(true);
      for (const task of learner.today_tasks) {
        for (const id of task.knowledge_point_ids) expect(points.has(id), `${exam} 任务 ${task.title} 的知识点`).toBe(true);
        for (const id of task.question_ids) {
          const question = questions.get(id);
          expect(question, `${exam} 任务 ${task.title} 的题目 ${id}`).toBeDefined();
          const shared = task.knowledge_point_ids.some((kp) => question?.knowledge_point_ids.includes(kp));
          expect(shared, `${exam} 题组与题目的知识点`).toBe(true);
          const name = points.get(question?.knowledge_point_ids[0] ?? "") ?? "";
          expect(task.title.includes(name), `${exam} 题组名“${task.title}”要写题目的知识点“${name}”`).toBe(true);
        }
      }
      const types = new Map(profile.question_types.map((t) => [t.type, t.response_form]));
      for (const q of content.questions) {
        const form = types.get(q.question_type);
        if (form !== undefined) expect(form, `${exam} 题目 ${q.id} 的作答形态与考试画像一致`).toBe(q.response_form);
      }
    }
  });
});
