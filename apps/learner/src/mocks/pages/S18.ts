// S18 做题与解析的假数据（U18a；api-rules 第 3、4 节）。题目取 fixtures/exams/ 与 fixtures/pages/S18/<考试 ID>.json（页面专用的演示题与两个示范题组：
// objective 题库、generated 导师出题）；prefill 是断点续做前已经做过的题。题组里新交的作答记在内存里（按内存仓库实例分开）；
// 考试数据里本来就有的题同时写进内存仓库的作答，错题本、今日清单跟着变。
// 规则还没实现：对错按示例答案比，证据强度与原因按 fixtures 里的 sample_rules 给，整份标 data_source 为 sample。
// ?state= 的空、受限、数据不足由下面的 variants 给数据（受限＝测评态：不能切换模式、不能看提示）；加载、出错、离线由接口层统一处理（mocks/api.ts）。
import { ApiError } from "@exam-prep/contract/errors";
import { DEMO_PARAM } from "../../routes.ts";
import type { MockDb } from "../db.ts";
import type { DemoExam, QuestionFixture } from "../demo.ts";
import { defineRoute, type MockContext } from "../route.ts";

type Json = Record<string, unknown>;
type Mode = "normal" | "empty" | "restricted" | "insufficient_data";
type Kind = "objective" | "generated";

/** 导师出题的示范题组（与页面 data.ts 的 DEMO_GENERATED 是同一个值）。 */
const DEMO_GENERATED = `${DEMO_PARAM}-gen`;
const CONFIDENCES: readonly string[] = ["sure", "vague", "guess", "off"];
const VERDICTS: readonly string[] = ["ok", "problem"];
const STRENGTH_ORDER: readonly string[] = ["weak", "medium", "strong"];
const MS_PER_SECOND = 1000;
const QUESTION_OPTIONAL_KEYS = ["options", "label", "hints"] as const;
const SOLUTION_KEYS = [
  "answer",
  "explanation",
  "option_notes",
  "common_wrong_option",
  "group_miss_rate",
  "scoring_points",
  "sample_answer",
] as const;

interface Prefill {
  readonly selected?: readonly number[];
  readonly text?: string;
  readonly confidence: string;
  readonly duration_ms: number;
  readonly hint_level?: number;
  readonly check?: string;
  readonly error_cause?: string;
}

interface ItemFixture {
  readonly question_id: string;
  readonly suggested_seconds: number;
  readonly flagged?: boolean;
  readonly revised?: boolean;
  readonly prefill?: Prefill;
}

interface SessionFixture {
  readonly title: string;
  readonly mode: string;
  readonly confidence_enabled: boolean;
  readonly elapsed_seconds: number;
  readonly limit_seconds?: number;
  readonly items: readonly ItemFixture[];
}

/** 规则还没实现时的示例做法（数据，不是规则代码）：秒答的界限、各级题目的证据上限、小结里列几个下一步。 */
interface SampleRules {
  readonly fast_answer_ms: number;
  readonly credibility_caps: Readonly<Record<string, string>>;
  readonly next_steps_limit: number;
}

interface PageFixture {
  readonly sample_rules: SampleRules;
  readonly sessions: Readonly<Record<Kind, SessionFixture>>;
  readonly questions: readonly QuestionFixture[];
}

/** 一题的作答（只追加：揭晓后不再收；测评态交卷前可以重交，以最后一次为准）。 */
interface Answer {
  readonly response: Json;
  readonly confidence: string;
  readonly duration_ms: number;
  readonly hint_level: number;
  readonly mistake_id: string | null;
  readonly error_cause?: string | undefined;
}

interface Live {
  readonly answers: Map<string, Answer>;
  readonly checks: Map<string, string>;
  readonly handedIn: Set<string>;
}

interface Verdict {
  readonly graded: boolean;
  readonly correct: boolean | null;
}

interface Evidence {
  readonly strength: string;
  readonly reason: string;
  readonly counted: boolean;
}

interface Located {
  readonly exam: DemoExam;
  readonly page: PageFixture;
  readonly kind: Kind;
  readonly fixture: SessionFixture;
  /** 题组在内存里的键（考试 ID 加题组来源）。 */
  readonly key: string;
  readonly sessionId: string;
}

/** 一题算好的样子，加上算进度与小结要用的几项。 */
interface Row {
  readonly item: Json;
  readonly status: string;
  readonly verdict: Verdict | null;
  readonly evidence: Evidence | null;
  readonly seconds: number | null;
  readonly suggested: number;
  readonly cause: string | null;
  readonly pointId: string;
  readonly pointName: string;
  readonly mistake: boolean;
  readonly hasOptions: boolean;
}

const FILES = import.meta.glob("../../../../../fixtures/pages/S18/*.json", { eager: true, import: "default" });
const LIVE = new WeakMap<MockDb, Live>();

const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const numbers = (value: unknown): number[] => (Array.isArray(value) ? value.filter((v): v is number => Number.isInteger(v)) : []);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const itemIdOf = (index: number): string => `i${index + 1}`;

function pick(source: Readonly<Record<string, unknown>>, keys: readonly string[]): Json {
  return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}

function sameSequence<T>(given: readonly T[], expected: readonly T[]): boolean {
  return given.length === expected.length && given.every((value, index) => value === expected[index]);
}

function sameSet(given: readonly number[], expected: readonly number[]): boolean {
  const byValue = (a: number, b: number) => a - b;
  return sameSequence([...given].sort(byValue), [...expected].sort(byValue));
}

function live(db: MockDb): Live {
  const found = LIVE.get(db);
  if (found !== undefined) return found;
  const created: Live = { answers: new Map(), checks: new Map(), handedIn: new Set() };
  LIVE.set(db, created);
  return created;
}

function pageFixture(examId: string): PageFixture {
  const hit = Object.entries(FILES).find(([path]) => path.endsWith(`/${examId}.json`));
  if (hit === undefined) throw new ApiError("COMMON_NOT_FOUND", { exam_id: examId, reason: "no_demo_session" });
  return hit[1] as PageFixture;
}

/** demo：当前演示考试的示范题组（题库）；demo-gen：导师出题的示范题组。别的 ID 回 404。 */
function locate(ctx: MockContext): Located {
  const asked = ctx.params["sessionId"] ?? DEMO_PARAM;
  const kind: Kind | null = asked === DEMO_PARAM ? "objective" : asked === DEMO_GENERATED ? "generated" : null;
  if (kind === null) throw new ApiError("COMMON_NOT_FOUND", { session_id: asked });
  const page = pageFixture(ctx.exam.examId);
  return { exam: ctx.exam, page, kind, fixture: page.sessions[kind], key: `${ctx.exam.examId}:${kind}`, sessionId: asked };
}

function questionOf(where: Located, questionId: string): QuestionFixture {
  const found = where.page.questions.find((q) => q.id === questionId) ?? where.exam.questions.find((q) => q.id === questionId);
  if (found === undefined) throw new ApiError("COMMON_NOT_FOUND", { question_id: questionId });
  return found;
}

function pointName(exam: DemoExam, pointId: string): string {
  for (const chapter of exam.map.chapters) {
    const point = chapter.sample_points.find((p) => p.id === pointId);
    if (point !== undefined) return point.name;
  }
  return "";
}

function questionView(exam: DemoExam, question: QuestionFixture, credibility: string): Json {
  return {
    id: question.id,
    version: question.version,
    exam_id: exam.examId,
    question_type: question.question_type,
    response_form: question.response_form,
    credibility,
    knowledge_point_ids: [...question.knowledge_point_ids],
    stem: question.stem,
    ...pick(question, QUESTION_OPTIONAL_KEYS),
  };
}

/** 示例判分：选择按集合比，排序按次序比，填空与分步逐段比；主观题不自动判。 */
function grade(question: QuestionFixture, response: Json): Verdict {
  const answer = numbers(question.answer);
  const texts = strings(question["answer_texts"]);
  const selected = numbers(response["selected"]);
  if (question.response_form === "match_order" && answer.length > 0) return { graded: true, correct: sameSequence(selected, answer) };
  if (answer.length > 0) return { graded: true, correct: sameSet(selected, answer) };
  if (texts.length > 0) {
    const given = (text(response["text"]) ?? "").split("\n").map((part) => part.trim());
    return { graded: true, correct: sameSequence(given, texts) };
  }
  return { graded: false, correct: null };
}

function weaker(strength: string, cap: string): string {
  const a = STRENGTH_ORDER.indexOf(strength);
  const b = STRENGTH_ORDER.indexOf(cap);
  return a < 0 || b < 0 ? strength : (STRENGTH_ORDER[Math.min(a, b)] ?? strength);
}

/** 示例证据：先做后核没确认不计；做错记负；蒙对、秒答记待验证；用过提示记弱；模糊或关了把握度最高记中；再按题目可信度封顶。 */
function evidenceOf(rules: SampleRules, credibility: string, verdict: Verdict, answer: Answer, check: string): Evidence {
  if (check === "problem") return { strength: "pending", reason: "question_problem", counted: false };
  if (check === "pending") return { strength: "pending", reason: "awaiting_check", counted: false };
  if (!verdict.graded) return { strength: "pending", reason: "ungraded", counted: false };
  if (verdict.correct === false) return { strength: "negative", reason: "wrong", counted: true };
  if (answer.confidence === "guess") return { strength: "pending", reason: "guess_correct", counted: true };
  if (answer.duration_ms < rules.fast_answer_ms) return { strength: "pending", reason: "too_fast", counted: true };
  const cap = rules.credibility_caps[credibility] ?? "strong";
  if (answer.hint_level > 0) return { strength: weaker("weak", cap), reason: "hint_used", counted: true };
  if (answer.confidence === "off") return { strength: weaker("medium", cap), reason: "confidence_off", counted: true };
  if (answer.confidence === "vague") return { strength: weaker("medium", cap), reason: "vague_correct", counted: true };
  return { strength: weaker("strong", cap), reason: "sure_correct", counted: true };
}

function fromPrefill(prefill: Prefill): Answer {
  return {
    response: {
      ...(prefill.selected === undefined ? {} : { selected: [...prefill.selected] }),
      ...(prefill.text === undefined ? {} : { text: prefill.text }),
    },
    confidence: prefill.confidence,
    duration_ms: prefill.duration_ms,
    hint_level: prefill.hint_level ?? 0,
    mistake_id: null,
    error_cause: prefill.error_cause,
  };
}

/** 空态（这一组题做完了）：没做过的题按参考答案补上，整组都已揭晓。 */
function synthesize(question: QuestionFixture, item: ItemFixture): Prefill {
  const base = { confidence: "sure", duration_ms: item.suggested_seconds * MS_PER_SECOND };
  const answer = numbers(question.answer);
  if (answer.length > 0) return { ...base, selected: answer };
  const texts = strings(question["answer_texts"]);
  if (texts.length > 0) return { ...base, text: texts.join("\n") };
  if (question.response_form === "practical_self") return { ...base, selected: strings(question["parts"]).map((_part, index) => index) };
  return { ...base, text: text(question["sample_answer"]) ?? "" };
}

function solutionOf(question: QuestionFixture, mode: Mode): Json {
  const solution: Json = { question_id: question.id, ...pick(question, SOLUTION_KEYS) };
  if (mode !== "insufficient_data") return solution;
  // 数据不足：没有群体数据（自有题、自建考试），不给误选率与常见错项
  const rest = Object.fromEntries(Object.entries(solution).filter(([key]) => key !== "common_wrong_option"));
  return { ...rest, group_miss_rate: null };
}

function buildRow(where: Located, state: Live, mode: Mode, index: number, fixture: ItemFixture, open: boolean): Row {
  const itemId = itemIdOf(index);
  const storeKey = `${where.key}:${itemId}`;
  const question = questionOf(where, fixture.question_id);
  const stored = state.answers.get(storeKey);
  const prefill = fixture.prefill ?? (mode === "empty" ? synthesize(question, fixture) : undefined);
  const answer = stored ?? (prefill === undefined ? undefined : fromPrefill(prefill));
  const status = answer === undefined ? "unanswered" : open && mode !== "empty" ? "answered" : "revealed";
  const savedCheck = state.checks.get(storeKey) ?? fixture.prefill?.check;
  const check =
    where.kind === "generated"
      ? mode === "empty"
        ? savedCheck === "problem"
          ? "problem"
          : "ok"
        : (savedCheck ?? "pending")
      : "not_needed";
  const credibility = where.kind === "generated" ? (check === "ok" ? "generated_confirmed" : "generated_instant") : question.credibility;
  const verdict = status === "revealed" && answer !== undefined ? grade(question, answer.response) : null;
  const evidence =
    verdict === null || answer === undefined ? null : evidenceOf(where.page.sample_rules, credibility, verdict, answer, check);
  const sampleMistake = stored === undefined && where.kind === "objective" && verdict?.correct === false ? storeKey : null;
  const mistakeId = answer?.mistake_id ?? sampleMistake;
  const pointId = question.knowledge_point_ids[0] ?? "";
  const material = text(question["material"]);
  const parts = strings(question["parts"]);
  const item: Json = {
    id: itemId,
    index,
    question: questionView(where.exam, question, credibility),
    knowledge_point_name: pointName(where.exam, pointId),
    ...(material === undefined ? {} : { material }),
    ...(parts.length === 0 ? {} : { parts }),
    suggested_seconds: fixture.suggested_seconds,
    status,
    flagged: fixture.flagged ?? false,
    ...(answer === undefined
      ? {}
      : {
          answer: {
            response: answer.response,
            confidence: answer.confidence,
            duration_ms: answer.duration_ms,
            hint_level: answer.hint_level,
          },
        }),
    ...(verdict === null || evidence === null
      ? {}
      : {
          result: {
            graded: verdict.graded,
            correct: verdict.correct,
            evidence_strength: evidence.strength,
            evidence_reason: evidence.reason,
            evidence_counted: evidence.counted,
            mistake_id: mistakeId,
            solution: solutionOf(question, mode),
          },
        }),
    check,
    ...(fixture.revised === true && verdict !== null ? { revised: true } : {}),
  };
  return {
    item,
    status,
    verdict,
    evidence,
    seconds: answer === undefined ? null : Math.round(answer.duration_ms / MS_PER_SECOND),
    suggested: fixture.suggested_seconds,
    cause: answer?.error_cause ?? null,
    pointId,
    pointName: pointName(where.exam, pointId),
    mistake: mistakeId !== null,
    hasOptions: (question.options?.length ?? 0) > 0,
  };
}

/** 示例小结：对了多少、慢在哪、错因分布、下一步练什么（做错的、待验证的、慢的知识点，去重后取前几个）。 */
function summaryOf(rules: SampleRules, rows: readonly Row[]): Json {
  const wrong = rows.filter((row) => row.verdict?.correct === false);
  const pending = rows.filter((row) => row.evidence?.counted === true && row.evidence.strength === "pending");
  const causes = new Map<string, number>();
  for (const row of wrong) if (row.cause !== null) causes.set(row.cause, (causes.get(row.cause) ?? 0) + 1);
  const overtime = rows.flatMap((row, index) =>
    row.seconds !== null && row.seconds > row.suggested ? [{ index, seconds: row.seconds, suggested_seconds: row.suggested }] : [],
  );
  const steps: Json[] = [];
  const add = (row: Row | undefined, reason: string) => {
    if (row !== undefined && row.pointId !== "" && !steps.some((step) => step["point_id"] === row.pointId)) {
      steps.push({ point_id: row.pointId, point_name: row.pointName, reason });
    }
  };
  wrong.forEach((row) => add(row, "wrong"));
  pending.forEach((row) => add(row, "pending"));
  overtime.forEach((entry) => add(rows[entry.index], "slow"));
  return {
    total: rows.length,
    correct: rows.filter((row) => row.verdict?.correct === true).length,
    overtime,
    error_causes: [...causes.entries()].map(([cause, count]) => ({ cause, count })),
    uncategorized: wrong.filter((row) => row.cause === null).length,
    mistakes_added: rows.filter((row) => row.mistake).length,
    pending: pending.length,
    next_steps: steps.slice(0, rules.next_steps_limit),
  };
}

const isAssessment = (where: Located, mode: Mode): boolean => mode === "restricted" || where.fixture.mode === "assessment";

function sessionBody(ctx: MockContext, mode: Mode): Json {
  const where = locate(ctx);
  const state = live(ctx.db);
  const assessment = isAssessment(where, mode);
  const open = assessment && !state.handedIn.has(where.key);
  const rows = where.fixture.items.map((fixture, index) => buildRow(where, state, mode, index, fixture, open));
  const count = (test: (row: Row) => boolean): number => rows.filter(test).length;
  const unanswered = count((row) => row.status === "unanswered");
  // feat:S18-12 作答结束仍要完成生成题核对，重新进入时回到第一道待核对题。
  const firstPendingCheck = rows.findIndex((row) => row.status === "revealed" && row.item["check"] === "pending");
  const finished = mode === "empty" || (assessment ? !open : unanswered === 0 && firstPendingCheck < 0);
  const firstOpen = rows.findIndex((row) => row.status === "unanswered");
  const firstAction = assessment && !open ? firstPendingCheck : firstOpen >= 0 ? firstOpen : firstPendingCheck;
  const lastChoice = rows.reduce((found, row, index) => (row.status === "revealed" && row.hasOptions ? index : found), -1);
  const resume =
    mode === "insufficient_data" && lastChoice >= 0 ? lastChoice : firstAction >= 0 ? firstAction : Math.max(0, rows.length - 1);
  const spent = [...state.answers.entries()]
    .filter(([key]) => key.startsWith(`${where.key}:`))
    .reduce((sum, [, answer]) => sum + answer.duration_ms, 0);
  return {
    id: where.sessionId,
    title: where.fixture.title,
    kind: where.kind,
    mode: assessment ? "assessment" : where.fixture.mode,
    confidence_enabled: where.fixture.confidence_enabled,
    items: rows.map((row) => row.item),
    progress: {
      total: rows.length,
      correct: count((row) => row.verdict?.correct === true),
      wrong: count((row) => row.verdict?.correct === false),
      waiting: count((row) => row.status === "answered" || (row.verdict !== null && row.verdict.correct === null)),
      unanswered,
    },
    resume_index: resume,
    time: {
      elapsed_seconds: where.fixture.elapsed_seconds + Math.round(spent / MS_PER_SECOND),
      ...(where.fixture.limit_seconds === undefined ? {} : { limit_seconds: where.fixture.limit_seconds }),
    },
    restrictions: { mode_locked: assessment, hints_locked: assessment },
    other_device: false,
    finished,
    ...(finished ? { summary: summaryOf(where.page.sample_rules, rows) } : {}),
    data_source: "sample",
  };
}

function itemAt(where: Located, itemId: string): number {
  const index = where.fixture.items.findIndex((_item, i) => itemIdOf(i) === itemId);
  if (index < 0) throw new ApiError("COMMON_NOT_FOUND", { item_id: itemId });
  return index;
}

function itemBody(ctx: MockContext, mode: Mode, index: number): Json {
  const items = sessionBody(ctx, mode)["items"];
  const item: unknown = Array.isArray(items) ? items[index] : undefined;
  if (!isRecord(item)) throw new ApiError("COMMON_NOT_FOUND", { index });
  return item;
}

/** 考试数据里本来就有的题：同时写进内存仓库的作答（判分、错题本、今日清单跟着变），记下错题 ID。 */
function recordInDb(ctx: MockContext, where: Located, question: QuestionFixture, answer: Answer): string | null {
  if (!where.exam.questions.some((q) => q.id === question.id)) return null;
  const recorded = ctx.db.submitAnswer(
    {
      question_id: question.id,
      question_version: question.version,
      response: answer.response,
      confidence: answer.confidence,
      duration_ms: answer.duration_ms,
      hint_level: answer.hint_level,
    },
    ctx.now,
  );
  return text(recorded["mistake_id"]) ?? null;
}

function submit(ctx: MockContext, mode: Mode): Json {
  const where = locate(ctx);
  const body = isRecord(ctx.body) ? ctx.body : {};
  const itemId = text(body["item_id"]) ?? "";
  const index = itemAt(where, itemId);
  const fixture = where.fixture.items[index];
  if (fixture === undefined) throw new ApiError("COMMON_NOT_FOUND", { item_id: itemId });
  const question = questionOf(where, fixture.question_id);
  if (body["question_id"] !== question.id) throw new ApiError("COMMON_VALIDATION", { field: "question_id", expected: question.id });
  if (body["question_version"] !== question.version)
    throw new ApiError("COMMON_VALIDATION", { field: "question_version", expected: question.version });
  const confidence = body["confidence"];
  if (typeof confidence !== "string" || !CONFIDENCES.includes(confidence))
    throw new ApiError("PRAC_CONFIDENCE_REQUIRED", { item_id: itemId });
  const state = live(ctx.db);
  // feat:S18-02 交卷锁定整场练习，未作答题也不能在交卷后补交。
  if (state.handedIn.has(where.key)) throw new ApiError("PRAC_REVEAL_LOCKED", { session_id: where.sessionId });
  const storeKey = `${where.key}:${itemId}`;
  const open = isAssessment(where, mode);
  const answeredBefore = fixture.prefill !== undefined || state.answers.has(storeKey);
  if (answeredBefore && !open) throw new ApiError("PRAC_REVEAL_LOCKED", { item_id: itemId });
  const duration = body["duration_ms"];
  const hints = body["hint_level"];
  const answer: Answer = {
    response: isRecord(body["response"]) ? body["response"] : {},
    confidence,
    duration_ms: typeof duration === "number" && Number.isInteger(duration) ? duration : 0,
    hint_level: typeof hints === "number" && Number.isInteger(hints) ? hints : 0,
    mistake_id: null,
  };
  // 测评态交卷前不揭晓、也不写进内存仓库（交卷时一起写）
  state.answers.set(storeKey, open ? answer : { ...answer, mistake_id: recordInDb(ctx, where, question, answer) });
  return itemBody(ctx, mode, index);
}

function check(ctx: MockContext, mode: Mode): Json {
  const where = locate(ctx);
  const body = isRecord(ctx.body) ? ctx.body : {};
  const itemId = text(body["item_id"]) ?? "";
  const verdict = text(body["verdict"]) ?? "";
  const index = itemAt(where, itemId);
  if (where.kind !== "generated" || !VERDICTS.includes(verdict))
    throw new ApiError("COMMON_VALIDATION", { field: "verdict", item_id: itemId });
  const current = itemBody(ctx, mode, index);
  if (current["status"] !== "revealed") throw new ApiError("COMMON_VALIDATION", { field: "item_id", reason: "not_revealed" });
  if (current["check"] !== "pending") throw new ApiError("PRAC_REVEAL_LOCKED", { item_id: itemId });
  live(ctx.db).checks.set(`${where.key}:${itemId}`, verdict);
  return itemBody(ctx, mode, index);
}

function finish(ctx: MockContext, mode: Mode): Json {
  const where = locate(ctx);
  if (!isAssessment(where, mode)) throw new ApiError("COMMON_VALIDATION", { field: "mode", reason: "not_assessment" });
  const state = live(ctx.db);
  if (!state.handedIn.has(where.key)) {
    where.fixture.items.forEach((fixture, index) => {
      const storeKey = `${where.key}:${itemIdOf(index)}`;
      const answer = state.answers.get(storeKey);
      if (answer !== undefined)
        state.answers.set(storeKey, { ...answer, mistake_id: recordInDb(ctx, where, questionOf(where, fixture.question_id), answer) });
    });
    state.handedIn.add(where.key);
  }
  return sessionBody(ctx, mode);
}

export const routes = [
  defineRoute("getQuizSession", (ctx) => sessionBody(ctx, "normal"), {
    variants: {
      empty: (ctx) => sessionBody(ctx, "empty"),
      restricted: (ctx) => sessionBody(ctx, "restricted"),
      insufficient_data: (ctx) => sessionBody(ctx, "insufficient_data"),
    },
  }),
  defineRoute("submitQuizAnswer", (ctx) => submit(ctx, "normal"), {
    variants: { restricted: (ctx) => submit(ctx, "restricted"), insufficient_data: (ctx) => submit(ctx, "insufficient_data") },
  }),
  defineRoute("checkGeneratedQuestion", (ctx) => check(ctx, "normal"), {
    variants: { restricted: (ctx) => check(ctx, "restricted"), insufficient_data: (ctx) => check(ctx, "insufficient_data") },
  }),
  defineRoute("finishQuizSession", (ctx) => finish(ctx, "normal"), {
    variants: { restricted: (ctx) => finish(ctx, "restricted"), insufficient_data: (ctx) => finish(ctx, "insufficient_data") },
  }),
];
