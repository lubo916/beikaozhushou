// S10 知识点主页的假数据（F08；api-rules 第 3、4 节）。知识点、掌握档、题目、卡片、笔记与学员资料取 fixtures/exams/，
// 地图补充的演示点复用 S09 的解码（ID、名称、掌握档与范围一致）；页面专用的示例（错误模式、证据、资料位置、考点档案等）取 fixtures/pages/S10/<考试 ID>.json。
// 规则还没实现：档位差只是把演示数据里的两个档相减，整份标 data_source 为 sample；关联题目的状态会随内存仓库里的作答变。
// ?state= 的空、受限、数据不足由下面的 variants 给数据；加载、出错、离线由接口层统一处理（mocks/api.ts），这里不管。
import { ApiError } from "@exam-prep/contract/errors";
import { DEMO_PARAM } from "../../routes.ts";
import type { ChapterFixture, DemoExam, PointFixture, QuestionFixture } from "../demo.ts";
import { defineRoute, type MockContext } from "../route.ts";
import { mapChapters, type Cell } from "./S09.ts";

type Json = Record<string, unknown>;
type Mode = "normal" | "empty" | "restricted" | "insufficient_data";

interface History {
  readonly wrong: number;
  readonly correct: number;
}

interface MistakeFixture {
  readonly question_id: string;
  /** 选了第几个选项（从 0 数）；选项原文与点评取题目数据。 */
  readonly option: number;
  readonly reason?: string;
  readonly trap?: string;
  readonly error_cause?: string;
}

interface RelationFixture {
  readonly type: string;
  readonly items: readonly { readonly point_id?: string; readonly name: string; readonly origin: string; readonly pending: boolean }[];
}

/** fixtures/pages/S10/<考试 ID>.json 里一个知识点的页面专用示例。 */
interface PointExtra {
  readonly section_name?: string;
  readonly importance?: { readonly default_level: number; readonly level?: number };
  readonly exam_level?: number;
  readonly starred?: boolean;
  readonly difficulty?: Json;
  readonly self?: number;
  readonly self_pending?: boolean;
  readonly question_history?: Readonly<Record<string, History>>;
  readonly question_groups?: readonly Json[];
  readonly pattern?: Json;
  readonly mistakes?: readonly MistakeFixture[];
  readonly evidence?: { readonly total: number; readonly items: readonly Json[] };
  readonly materials?: readonly Json[];
  readonly material_locations?: Readonly<Record<string, Json>>;
  readonly exam_profile?: Json;
  readonly relations?: readonly RelationFixture[];
  readonly cards_due_tomorrow?: number;
  readonly add_today?: { readonly minutes: number; readonly displaces?: string };
  readonly attack_pack_minutes?: number;
}

interface PageFixture {
  readonly demo_point_id: string;
  readonly defaults: {
    readonly importance_level: number;
    readonly difficulty: Json;
    readonly add_today_minutes: number;
    readonly attack_pack_minutes: number;
    readonly exam_profile: Json;
  };
  readonly points: Readonly<Record<string, PointExtra>>;
}

const FILES = import.meta.glob("../../../../../fixtures/pages/S10/*.json", { eager: true, import: "default" });

/** 新加的演示考试还没有页面示例时用的演示值。 */
const NO_PAGE: PageFixture = {
  demo_point_id: "",
  defaults: {
    importance_level: 2,
    difficulty: { objective: "typical", personalized: false },
    add_today_minutes: 15,
    attack_pack_minutes: 30,
    exam_profile: { maturity: "cold" },
  },
  points: {},
};

/** ?state=insufficient_data 时的考点档案（演示值）：成熟中，只给原始次数。 */
const MATURING_SAMPLE: Json = { maturity: "maturing", raw: { appearances: 1, years_covered: 2, years_missing: 3 } };

/** 关联题目的排序：我做错的、我没做过的、做对过的（S10-12）。 */
const STATUS_ORDER: Readonly<Record<string, number>> = { wrong: 0, untried: 1, correct: 2 };

const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

const covers = (record: Json, pointId: string): boolean =>
  Array.isArray(record["knowledge_point_ids"]) && (record["knowledge_point_ids"] as unknown[]).includes(pointId);

function pageFixture(examId: string): PageFixture {
  const hit = Object.entries(FILES).find(([path]) => path.endsWith(`/${examId}.json`));
  return hit === undefined ? NO_PAGE : (hit[1] as PageFixture);
}

/** demo：当前演示考试的示范知识点（页面示例里指定的，没有就取第一个有题目的）。 */
function demoPointId(exam: DemoExam): string {
  const fixed = pageFixture(exam.examId).demo_point_id;
  if (fixed !== "") return fixed;
  const points = exam.map.chapters.flatMap((chapter) => chapter.sample_points);
  const withQuestions = points.find((point) => exam.questions.some((q) => q.knowledge_point_ids.includes(point.id)));
  return withQuestions?.id ?? points[0]?.id ?? "";
}

interface Located {
  readonly exam: DemoExam;
  readonly chapter: ChapterFixture;
  readonly chapterNo: number;
  readonly point: PointFixture;
  readonly cell: Cell;
}

/** 按知识点 ID 找它所在的考试与章（知识点 ID 全局唯一）；找不到回 404。 */
function locate(ctx: MockContext): Located {
  const asked = ctx.params["pointId"] ?? DEMO_PARAM;
  const id = asked === DEMO_PARAM ? demoPointId(ctx.exam) : asked;
  for (const exam of ctx.db.fixtures.exams) {
    for (const [index, { chapter, cells }] of mapChapters(exam).entries()) {
      const cell = cells.find((candidate) => candidate.id === id);
      if (cell === undefined) continue;
      // 地图补充的演示点也有详情；只接受解码后确实存在的 ID，未知或越界 ID 仍走 404。
      const point = chapter.sample_points.find((candidate) => candidate.id === id) ?? {
        id: cell.id,
        name: cell.name,
        knowledge_types: cell.types,
        default_target_level: cell.target ?? 0,
      };
      return { exam, chapter, chapterNo: index + 1, point, cell };
    }
  }
  throw new ApiError("COMMON_NOT_FOUND", { point_id: asked });
}

function optionNote(question: QuestionFixture, option: number): string {
  const notes = question["option_notes"];
  const entry = isRecord(notes) ? notes[String(option)] : undefined;
  return isRecord(entry) && typeof entry["note"] === "string" ? entry["note"] : "";
}

function mistakeRows(exam: DemoExam, extra: PointExtra): Json[] {
  return (extra.mistakes ?? []).flatMap((m) => {
    const question = exam.questions.find((q) => q.id === m.question_id);
    if (question === undefined) return [];
    return [
      {
        question_id: m.question_id,
        chosen: question.options?.[m.option] ?? "",
        reason: m.reason ?? optionNote(question, m.option),
        ...(m.trap === undefined ? {} : { trap: m.trap }),
        ...(m.error_cause === undefined ? {} : { error_cause: m.error_cause }),
      },
    ];
  });
}

/** 关联题目：这个知识点的题（做过几次＝示例里的历史＋内存仓库里的作答）加上示例题组，按 S10-12 排序。 */
function relatedQuestions(ctx: MockContext, exam: DemoExam, pointId: string, extra: PointExtra): Json[] {
  const attempts = ctx.db.attempts(exam.examId);
  const own = exam.questions
    .filter((q) => q.knowledge_point_ids.includes(pointId))
    .map((q): Json => {
      const before = extra.question_history?.[q.id] ?? { wrong: 0, correct: 0 };
      const mine = attempts.filter((a) => a.questionId === q.id);
      const wrong = before.wrong + mine.filter((a) => a.correct === false).length;
      const correct = before.correct + mine.filter((a) => a.correct === true).length;
      const base = { id: q.id, kind: "question", title: q.stem, credibility: q.credibility };
      if (wrong > 0) return { ...base, status: "wrong", times: wrong };
      if (correct > 0) return { ...base, status: "correct", times: correct };
      return { ...base, status: "untried", times: 0 };
    });
  const groups = (extra.question_groups ?? []).map((group): Json => ({ ...group, title: "" }));
  const rank = (row: Json): number => STATUS_ORDER[String(row["status"])] ?? 0;
  return [...own, ...groups].sort((a, b) => rank(a) - rank(b));
}

/** 在哪里学：示例里的平台与外部资料，加上学员自己接入、覆盖这个知识点的资料。 */
function materialSpots(exam: DemoExam, pointId: string, extra: PointExtra): Json[] {
  const own = exam.learner.materials
    .filter(isRecord)
    .filter((m) => covers(m, pointId))
    .map((m): Json => {
      const id = String(m["id"]);
      const location = extra.material_locations?.[id];
      return {
        id,
        title: String(m["title"]),
        access: String(m["access"]),
        licensed: false,
        ...(location === undefined ? {} : { location }),
      };
    });
  return [...(extra.materials ?? []), ...own];
}

/** 知识关系：前置知识点的档位差取演示数据里它的掌握档。 */
function relationGroups(exam: DemoExam, extra: PointExtra): Json[] {
  return (extra.relations ?? []).map((group) => ({
    type: group.type,
    items: group.items.map((item): Json => {
      const mastery = item.point_id === undefined ? undefined : exam.learner.mastery.find((m) => m.knowledge_point_id === item.point_id);
      if (group.type !== "prerequisite" || mastery === undefined) return { ...item };
      return { ...item, gap: (mastery.target_level ?? 0) - mastery.level };
    }),
  }));
}

function examProfile(mode: Mode, extra: PointExtra, page: PageFixture): Json {
  if (mode === "restricted") return { maturity: "cold" };
  if (mode === "insufficient_data")
    return page.defaults.exam_profile["maturity"] === "maturing" ? page.defaults.exam_profile : MATURING_SAMPLE;
  return extra.exam_profile ?? page.defaults.exam_profile;
}

/** 考情级：冷启动不给；成熟中按重要度估算；数据够了取示例里的考情级。 */
function examLevel(profile: Json, extra: PointExtra, importance: number): Json {
  if (profile["maturity"] === "cold") return { estimated: false };
  if (profile["maturity"] === "maturing") return { level: importance, estimated: true };
  return { level: extra.exam_level ?? importance, estimated: false };
}

function home(ctx: MockContext, mode: Mode): Json {
  const { exam, chapter, chapterNo, point, cell } = locate(ctx);
  const page = pageFixture(exam.examId);
  const extra: PointExtra = page.points[point.id] ?? {};
  const empty = mode === "empty";
  const system = cell.level;
  const target = cell.target ?? 0;
  const self = cell.self ?? extra.self;
  const importanceDefault = extra.importance?.default_level ?? cell.importance;
  const importance = extra.importance?.level ?? importanceDefault;
  const profile = examProfile(mode, extra, page);
  const spots = empty ? [] : materialSpots(exam, point.id, extra);
  const readerDoc = spots.find((spot) => spot["access"] === "parsable")?.["id"];
  const cardTotal = empty ? 0 : exam.cards.filter((card) => card.knowledge_point_id === point.id).length;
  const notes = empty ? [] : exam.learner.notes.filter(isRecord).filter((note) => covers(note, point.id));
  const inToday = exam.learner.today_tasks.some((task) => task.knowledge_point_ids.includes(point.id));
  const displaces = extra.add_today?.displaces;
  return {
    point: {
      id: point.id,
      name: point.name,
      chapter_no: chapterNo,
      chapter_name: chapter.name,
      ...(extra.section_name === undefined ? {} : { section_name: extra.section_name }),
      map_source: exam.map.source,
      knowledge_types: [...point.knowledge_types],
      scope_state: cell.inScope ? "default" : "removed",
      importance: { level: importance, default_level: importanceDefault, overridden: importance !== importanceDefault },
      exam_level: examLevel(profile, extra, importance),
      starred: extra.starred ?? false,
      difficulty: extra.difficulty ?? page.defaults.difficulty,
    },
    ladder: {
      system,
      target,
      target_is_default: target === point.default_target_level,
      gap: target - system,
      self_pending: extra.self_pending ?? false,
      evidence_sufficient: cell.sufficient,
      ...(self === undefined ? {} : { self, self_vs_system: self - system }),
    },
    methods: {
      knowledge_type: point.knowledge_types[0] ?? "concept",
      ...(typeof readerDoc === "string" ? { reader_doc_id: readerDoc } : {}),
    },
    mistakes: empty ? { rows: [] } : { rows: mistakeRows(exam, extra), ...(extra.pattern === undefined ? {} : { pattern: extra.pattern }) },
    questions: empty ? [] : relatedQuestions(ctx, exam, point.id, extra),
    evidence: empty || extra.evidence === undefined ? { items: [], total: 0 } : extra.evidence,
    materials: spots,
    exam_profile: profile,
    relations: empty ? [] : relationGroups(exam, extra),
    cards: { total: cardTotal, due_tomorrow: Math.min(extra.cards_due_tomorrow ?? 0, cardTotal) },
    notes: { total: notes.length, from_tutor: notes.filter((note) => note["ai_generated"] === true).length },
    add_today: {
      minutes: extra.add_today?.minutes ?? page.defaults.add_today_minutes,
      in_today: inToday,
      ...(inToday || displaces === undefined ? {} : { displaces }),
    },
    attack_pack: { minutes: extra.attack_pack_minutes ?? page.defaults.attack_pack_minutes },
    data_source: "sample",
  };
}

export const routes = [
  defineRoute("getKnowledgePointHome", (ctx) => home(ctx, "normal"), {
    variants: {
      empty: (ctx) => home(ctx, "empty"),
      restricted: (ctx) => home(ctx, "restricted"),
      insufficient_data: (ctx) => home(ctx, "insufficient_data"),
    },
  }),
];
