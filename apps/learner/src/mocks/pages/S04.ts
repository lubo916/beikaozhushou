// S04 摸底诊断的假数据（U04；api-rules 第 3、4 节，规则卡 diagnosis-start）。方式、题源、补充诊断与演示题库取
// fixtures/pages/S04/<考试 ID>.json；题库里的题可以直接引用 fixtures/exams/ 里的题（question_id）。会话记在内存里（按内存仓库实例分开）：
// 开始、交一题、暂停、接着做、改用快速定位、交按章自评、加入错题本都会真的改变它。
// 规则还没实现（选题与能力估计由 B08 做）：题按演示题库的顺序出，出完就交卷；分模块状态与估计档按下面的示例做法给，整份标 data_source 为 sample。
// ?view=test 且还没有会话时，按 fixtures 里的 demo 建一个进行中的演示会话（前几题已经答过）。
// ?state= 的空、受限、数据不足由 variants 给数据：空＝题源不足（只能快速定位）；受限＝测评限制提示；数据不足＝有模块要用同类数据代替或无依据。
// 加载、出错、离线由接口层统一处理（mocks/api.ts）。
import { ApiError } from "@exam-prep/contract/errors";
import type { MockDb } from "../db.ts";
import type { DemoExam, QuestionFixture } from "../demo.ts";
import { defineRoute, type MockContext } from "../route.ts";

type Json = Record<string, unknown>;
type Variant = "normal" | "empty" | "restricted" | "insufficient_data";
type Mode = "adaptive" | "quick" | "chapter" | "refresh";
type Stage = "rating" | "questions" | "finished";
type View = "start" | "test";

const MODES: readonly Mode[] = ["adaptive", "quick", "chapter", "refresh"];
const CONFIDENCES: readonly string[] = ["sure", "vague", "guess", "unknown"];
/** 按章自评四档，序号就是自评档 0–3（规则卡 R10）。 */
const RATINGS: readonly string[] = ["not_learned", "unfamiliar", "basic", "proficient"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SECONDS_PER_MINUTE = 60;
/** 示例做法用到的数（数据，不是规则代码）：掌握档上限、估计档的上下浮动、进行中模块进度条的示例填充。 */
const TOP_LEVEL = 5;
const SAMPLE_SPREAD = 1;
const IN_PROGRESS_SAMPLE = 0.5;
const OPTION_GAP = "　";
const ANSWER_JOIN = "；";

interface ModeFixture {
  readonly mode: Mode;
  readonly available: boolean;
  readonly unavailable_reason?: string;
  readonly recommended: boolean;
  readonly selected: boolean;
  readonly items?: number;
  readonly minutes: number;
  readonly chapter_items?: { readonly min: number; readonly max: number };
  readonly source?: string;
}

interface BankFixture {
  readonly module_id: string;
  readonly suggested_seconds: number;
  readonly question_id?: string;
  readonly question?: QuestionFixture;
  readonly material?: string;
  readonly parts?: readonly string[];
  readonly scoring_points?: readonly string[];
}

interface DemoAnswer {
  readonly selected: readonly number[];
  readonly confidence: string;
  readonly text?: string;
}

interface PageFixture {
  readonly exam_id: string;
  readonly pool: { readonly reviewed: number; readonly own: number };
  readonly empty_pool: { readonly reviewed: number; readonly own: number };
  readonly pool_sufficient: boolean;
  readonly min_pool_items: number;
  readonly modes: readonly ModeFixture[];
  readonly retake: boolean;
  readonly refresh?: { readonly items: number; readonly minutes: number };
  readonly group_data: boolean;
  readonly prior_estimate: { readonly low: number; readonly high: number };
  readonly check_items: number;
  readonly subjective_min_seconds: number;
  readonly insufficient_modules: number;
  readonly demo: { readonly mode: Mode; readonly answers: readonly DemoAnswer[] };
  readonly bank: readonly BankFixture[];
}

interface Entry {
  readonly question: QuestionFixture;
  readonly fixture: BankFixture;
}

interface Answer {
  readonly itemId: string;
  readonly bank: number;
  readonly selected: readonly number[];
  readonly text: string;
  readonly confidence: string;
}

interface Session {
  readonly id: string;
  mode: Mode;
  stage: Stage;
  paused: boolean;
  switched: boolean;
  readonly answers: Answer[];
  /** 还要出的题（题库里的序号，按顺序）。 */
  queue: number[];
  /** 等着按章自评的模块（快速定位）。 */
  rateModules: string[];
  readonly ratings: Map<string, string>;
  readonly added: Set<string>;
}

interface Live {
  readonly sessions: Map<string, Session>;
  seq: number;
}

const FILES = import.meta.glob("../../../../../fixtures/pages/S04/*.json", { eager: true, import: "default" });
const LIVE = new WeakMap<MockDb, Live>();

const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const numbers = (value: unknown): number[] => (Array.isArray(value) ? value.filter((v): v is number => Number.isInteger(v) && v >= 0) : []);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

function live(db: MockDb): Live {
  const found = LIVE.get(db);
  if (found !== undefined) return found;
  const created: Live = { sessions: new Map(), seq: 0 };
  LIVE.set(db, created);
  return created;
}

function pageOf(exam: DemoExam): PageFixture {
  const hit = Object.entries(FILES).find(([path]) => path.endsWith(`/${exam.examId}.json`));
  if (hit === undefined) throw new Error(`演示数据缺文件：fixtures/pages/S04/${exam.examId}.json`);
  return hit[1] as PageFixture;
}

/** 演示题库：页面数据里直接写的题，或按 question_id 引用考试数据里的题。 */
function bankOf(exam: DemoExam, page: PageFixture): Entry[] {
  return page.bank.map((fixture) => {
    const question = fixture.question ?? exam.questions.find((item) => item.id === fixture.question_id);
    if (question === undefined) throw new Error(`S04 演示题库引用了不存在的题：${fixture.question_id ?? "（没写 question_id）"}`);
    return { question, fixture };
  });
}

function moduleName(exam: DemoExam, moduleId: string): string {
  return exam.map.chapters.find((chapter) => chapter.id === moduleId)?.name ?? "";
}

/** 交给页面的题目：不含答案、解析，也不含提示（测评中不出现提示，R5）。 */
function questionBody(question: QuestionFixture, examId: string): Json {
  return {
    id: question.id,
    version: question.version,
    exam_id: examId,
    question_type: question.question_type,
    response_form: question.response_form,
    credibility: question.credibility,
    knowledge_point_ids: [...question.knowledge_point_ids],
    stem: question.stem,
    ...(question.options === undefined ? {} : { options: [...question.options] }),
    ...(question.label === undefined ? {} : { label: question.label }),
  };
}

function sameSet(given: readonly number[], expected: readonly number[]): boolean {
  const sorted = (list: readonly number[]): number[] => [...new Set(list)].sort((a, b) => a - b);
  const a = sorted(given);
  const b = sorted(expected);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** 起点估计里算“会”（规则卡 R7 的示例做法）：选“不会”、蒙的、做错都不算；主观题没有标准答案，不算。 */
function counted(entry: Entry, answer: Answer): boolean {
  const key = entry.question.answer;
  if (key === undefined || answer.confidence === "unknown" || answer.confidence === "guess") return false;
  return sameSet(answer.selected, key);
}

/** 诊断错题（R12）：做错与选“不会”；蒙对不算错题，主观题不判。 */
function mistakeOf(entry: Entry, answer: Answer): "wrong" | "unknown" | null {
  if (answer.confidence === "unknown") return "unknown";
  const key = entry.question.answer;
  if (key === undefined) return null;
  return sameSet(answer.selected, key) ? null : "wrong";
}

function itemIdOf(session: Session, index: number): string {
  return `${session.id}-${index + 1}`;
}

function createSession(store: Live, examKey: string, mode: Mode): Session {
  store.seq += 1;
  return {
    id: `diag-${examKey}-${store.seq}`,
    mode,
    stage: "questions",
    paused: false,
    switched: false,
    answers: [],
    queue: [],
    rateModules: [],
    ratings: new Map(),
    added: new Set(),
  };
}

/** ?view=test 用的演示会话：前几题按 fixtures 的 demo 已经答过，接着出题库里后面的题。 */
function demoSession(ctx: MockContext, page: PageFixture, store: Live): Session {
  const session = createSession(store, ctx.exam.key, page.demo.mode);
  page.demo.answers.forEach((answer, index) => {
    session.answers.push({
      itemId: itemIdOf(session, index),
      bank: index,
      selected: [...answer.selected],
      text: answer.text ?? "",
      confidence: answer.confidence,
    });
  });
  session.queue = page.bank.map((_entry, index) => index).slice(page.demo.answers.length);
  if (session.queue.length === 0) session.stage = "finished";
  return session;
}

function startSession(ctx: MockContext, page: PageFixture, store: Live, mode: Mode): Session {
  const session = createSession(store, ctx.exam.key, mode);
  const all = page.bank.map((_entry, index) => index);
  if (mode === "quick") {
    session.stage = "rating";
    session.rateModules = ctx.exam.map.chapters.map((chapter) => chapter.id);
  } else {
    session.queue = mode === "refresh" ? all.slice(0, page.refresh?.items ?? all.length) : all;
    if (session.queue.length === 0) session.stage = "finished";
  }
  return session;
}

/** 快速定位的核对题（R10 的示例做法）：按自评档从高到低选章（相同按地图里的章节顺序），每章最多 1 道没答过的客观题。 */
function checkQueue(page: PageFixture, bank: readonly Entry[], session: Session): number[] {
  const rank = (moduleId: string): number => RATINGS.indexOf(session.ratings.get(moduleId) ?? "");
  const order = [...session.rateModules].sort((a, b) => rank(b) - rank(a));
  const picks: number[] = [];
  for (const moduleId of order) {
    if (picks.length >= page.check_items) break;
    const index = bank.findIndex(
      (entry, i) =>
        entry.fixture.module_id === moduleId && entry.question.answer !== undefined && !session.answers.some((answer) => answer.bank === i),
    );
    if (index >= 0) picks.push(index);
  }
  return picks;
}

function band(center: number): Json {
  return { low: Math.max(0, center - SAMPLE_SPREAD), high: Math.min(TOP_LEVEL, center + SAMPLE_SPREAD) };
}

/** 交卷后的模块估计（示例做法，算法由 B08 实现）：做过题的按“会”的比例折成档；自评过的按自评档；同类数据给示例区间；无依据不给。 */
function estimateOf(
  page: PageFixture,
  bank: readonly Entry[],
  answers: readonly Answer[],
  rating: string | undefined,
  status: string,
): Json | undefined {
  if (answers.length > 0) {
    const known = answers.filter((answer) => {
      const entry = bank[answer.bank];
      return entry !== undefined && counted(entry, answer);
    }).length;
    return band(Math.round((known / answers.length) * (TOP_LEVEL - 1)));
  }
  if (rating !== undefined) return band(RATINGS.indexOf(rating));
  if (status === "prior") return { low: page.prior_estimate.low, high: page.prior_estimate.high };
  return undefined;
}

function moduleRows(ctx: MockContext, page: PageFixture, bank: readonly Entry[], session: Session, variant: Variant): Json[] {
  const finished = session.stage === "finished";
  const head = session.stage === "questions" ? session.queue[0] : undefined;
  const current = head === undefined ? undefined : bank[head]?.fixture.module_id;
  const unmeasured = page.group_data ? "prior" : "no_basis";
  return ctx.exam.map.chapters.map((chapter) => {
    const answers = session.answers.filter((answer) => bank[answer.bank]?.fixture.module_id === chapter.id);
    const rating = session.ratings.get(chapter.id);
    const measured = answers.length > 0 || rating !== undefined;
    const status =
      chapter.id === current
        ? "in_progress"
        : measured
          ? "estimated"
          : finished || variant === "insufficient_data"
            ? unmeasured
            : "not_started";
    const progress = status === "estimated" ? 1 : status === "in_progress" ? IN_PROGRESS_SAMPLE : 0;
    const estimate = finished ? estimateOf(page, bank, answers, rating, status) : undefined;
    return { module_id: chapter.id, name: chapter.name, status, progress, ...(estimate === undefined ? {} : { estimate }) };
  });
}

function itemBody(ctx: MockContext, page: PageFixture, bank: readonly Entry[], session: Session): Json | undefined {
  const head = session.queue[0];
  const entry = head === undefined ? undefined : bank[head];
  if (entry === undefined) return undefined;
  const { question, fixture } = entry;
  const points = fixture.scoring_points ?? [];
  return {
    id: itemIdOf(session, session.answers.length),
    index: session.answers.length,
    question: questionBody(question, ctx.exam.examId),
    module_name: moduleName(ctx.exam, fixture.module_id),
    suggested_seconds: fixture.suggested_seconds,
    ...(fixture.material === undefined ? {} : { material: fixture.material }),
    ...(fixture.parts === undefined ? {} : { parts: [...fixture.parts] }),
    ...(points.length === 0 ? {} : { scoring_points: [...points], self_check_after_seconds: page.subjective_min_seconds }),
  };
}

function mistakeRows(ctx: MockContext, bank: readonly Entry[], session: Session): Json[] {
  if (session.stage !== "finished") return [];
  return session.answers.flatMap((answer, index) => {
    const entry = bank[answer.bank];
    const outcome = entry === undefined ? null : mistakeOf(entry, answer);
    if (entry === undefined || outcome === null) return [];
    const options = entry.question.options ?? [];
    const answerText = (entry.question.answer ?? [])
      .map((option) => `${LETTERS.charAt(option)}${OPTION_GAP}${options[option] ?? ""}`)
      .join(ANSWER_JOIN);
    return [
      {
        item_id: answer.itemId,
        index,
        stem: entry.question.stem,
        module_name: moduleName(ctx.exam, entry.fixture.module_id),
        outcome,
        ...(answerText === "" ? {} : { answer_text: answerText }),
        added: session.added.has(answer.itemId),
      },
    ];
  });
}

function finishReason(session: Session): string {
  if (session.switched) return "switched_quick";
  if (session.mode === "quick") return "quick_finished";
  return session.mode === "adaptive" ? "precise_enough" : "max_items";
}

function sessionBody(ctx: MockContext, page: PageFixture, bank: readonly Entry[], session: Session, variant: Variant): Json {
  const rating = session.stage === "rating";
  const quickMinutes = page.modes.find((option) => option.mode === "quick")?.minutes ?? 1;
  const checks = rating ? checkQueue(page, bank, session).length : 0;
  const queueSeconds = session.queue.reduce((sum, index) => sum + (bank[index]?.fixture.suggested_seconds ?? 0), 0);
  const current = session.stage === "questions" ? itemBody(ctx, page, bank, session) : undefined;
  return {
    id: session.id,
    mode: session.mode,
    stage: session.stage,
    paused: session.paused,
    answered: session.answers.length,
    estimate_total: session.answers.length + (rating ? checks : session.queue.length),
    remaining_minutes: rating ? quickMinutes : Math.ceil(queueSeconds / SECONDS_PER_MINUTE),
    ...(current === undefined ? {} : { current }),
    ...(rating
      ? {
          rating: {
            modules: session.rateModules.map((id) => ({ module_id: id, name: moduleName(ctx.exam, id) })),
            check_items: checks,
            minutes: quickMinutes,
          },
        }
      : {}),
    modules: moduleRows(ctx, page, bank, session, variant),
    ...(session.stage === "finished" ? { finish_reason: finishReason(session) } : {}),
    mistakes: mistakeRows(ctx, bank, session),
  };
}

function viewParam(value: string | null): View | undefined {
  return value === "start" || value === "test" ? value : undefined;
}

/** 题源不足时（空态，R3）：只能快速定位。 */
function emptyModes(page: PageFixture): Json[] {
  return page.modes.map((option) =>
    option.mode === "quick"
      ? { ...option, available: true, recommended: false, selected: true }
      : { ...option, available: false, unavailable_reason: "pool_too_small", recommended: false, selected: false },
  );
}

function diagnosisBody(ctx: MockContext, variant: Variant): Json {
  const page = pageOf(ctx.exam);
  const bank = bankOf(ctx.exam, page);
  const store = live(ctx.db);
  const forced = viewParam(ctx.query.get("view"));
  let session = store.sessions.get(ctx.exam.examId);
  if (forced === "test" && session === undefined) {
    session = demoSession(ctx, page, store);
    store.sessions.set(ctx.exam.examId, session);
  }
  const empty = variant === "empty";
  const open = session !== undefined && session.stage !== "finished";
  const active = session !== undefined && session.stage !== "finished" && !session.paused;
  const thin = variant === "insufficient_data";
  return {
    view: forced ?? (active ? "test" : "start"),
    modes: empty ? emptyModes(page) : page.modes.map((option) => ({ ...option })),
    pool: { ...(empty ? page.empty_pool : page.pool) },
    pool_sufficient: !empty && page.pool_sufficient,
    min_pool_items: page.min_pool_items,
    retake: page.retake,
    ...(page.refresh === undefined || empty ? {} : { refresh: { ...page.refresh } }),
    prior_modules: thin && page.group_data ? page.insufficient_modules : 0,
    no_basis_modules: thin && !page.group_data ? page.insufficient_modules : 0,
    assessment_restricted: variant === "restricted" || open,
    ...(session === undefined ? {} : { session: sessionBody(ctx, page, bank, session, variant) }),
    data_source: "sample",
  };
}

function sessionFor(ctx: MockContext): Session {
  const session = live(ctx.db).sessions.get(ctx.exam.examId);
  const id = ctx.params["sessionId"] ?? "";
  if (session === undefined || session.id !== id) throw new ApiError("COMMON_NOT_FOUND", { session_id: id });
  return session;
}

function start(ctx: MockContext, variant: Variant): Json {
  const body = isRecord(ctx.body) ? ctx.body : {};
  const mode = MODES.find((value) => value === body["mode"]);
  if (mode === undefined) throw new ApiError("COMMON_VALIDATION", { field: "mode" });
  const page = pageOf(ctx.exam);
  const short = variant === "empty" || !page.pool_sufficient;
  const option = page.modes.find((value) => value.mode === mode);
  const allowed = mode === "quick" || (mode === "refresh" ? page.refresh !== undefined : !short && option?.available === true);
  if (!allowed) throw new ApiError("COMMON_VALIDATION", { field: "mode", reason: "unavailable" });
  const store = live(ctx.db);
  store.sessions.set(ctx.exam.examId, startSession(ctx, page, store, mode));
  return diagnosisBody(ctx, variant);
}

function submit(ctx: MockContext, variant: Variant): Json {
  const session = sessionFor(ctx);
  const body = isRecord(ctx.body) ? ctx.body : {};
  const head = session.queue[0];
  const expected = itemIdOf(session, session.answers.length);
  if (session.stage !== "questions" || head === undefined || body["item_id"] !== expected) {
    throw new ApiError("COMMON_VALIDATION", { field: "item_id" });
  }
  const confidence = CONFIDENCES.find((value) => value === body["confidence"]);
  if (confidence === undefined) throw new ApiError("PRAC_CONFIDENCE_REQUIRED", { field: "confidence" });
  const response = isRecord(body["response"]) ? body["response"] : {};
  const selected = numbers(response["selected"]);
  const text = typeof response["text"] === "string" ? response["text"] : "";
  // 选“不会”可以不作答；其他把握度要先作答（R6）
  if (confidence !== "unknown" && selected.length === 0 && text.trim() === "") throw new ApiError("COMMON_VALIDATION", { field: "response" });
  session.answers.push({ itemId: expected, bank: head, selected, text, confidence });
  session.queue = session.queue.slice(1);
  session.paused = false;
  if (session.queue.length === 0) session.stage = "finished";
  return diagnosisBody(ctx, variant);
}

function pause(ctx: MockContext, variant: Variant): Json {
  const session = sessionFor(ctx);
  if (session.stage !== "finished") session.paused = true;
  return diagnosisBody(ctx, variant);
}

function resume(ctx: MockContext, variant: Variant): Json {
  sessionFor(ctx).paused = false;
  return diagnosisBody(ctx, variant);
}

/** 测评中改用快速定位（R9）：已答的题保留，没答过题的章改成按章自评。 */
function switchQuick(ctx: MockContext, variant: Variant): Json {
  const session = sessionFor(ctx);
  if (session.stage === "finished") throw new ApiError("COMMON_VALIDATION", { reason: "finished" });
  const bank = bankOf(ctx.exam, pageOf(ctx.exam));
  const measured = new Set(session.answers.map((answer) => bank[answer.bank]?.fixture.module_id));
  session.rateModules = ctx.exam.map.chapters.map((chapter) => chapter.id).filter((id) => !measured.has(id));
  session.queue = [];
  session.mode = "quick";
  session.switched = true;
  session.paused = false;
  session.stage = session.rateModules.length > 0 ? "rating" : "finished";
  return diagnosisBody(ctx, variant);
}

function rate(ctx: MockContext, variant: Variant): Json {
  const session = sessionFor(ctx);
  if (session.stage !== "rating") throw new ApiError("COMMON_VALIDATION", { reason: "not_rating" });
  const body = isRecord(ctx.body) ? ctx.body : {};
  const rows = Array.isArray(body["ratings"]) ? body["ratings"].filter(isRecord) : [];
  const given = new Map<string, string>();
  for (const row of rows) {
    const id = typeof row["module_id"] === "string" ? row["module_id"] : "";
    const rating = RATINGS.find((value) => value === row["rating"]);
    if (session.rateModules.includes(id) && rating !== undefined) given.set(id, rating);
  }
  if (session.rateModules.some((id) => !given.has(id))) throw new ApiError("COMMON_VALIDATION", { field: "ratings" });
  for (const [id, rating] of given) session.ratings.set(id, rating);
  const page = pageOf(ctx.exam);
  session.queue = checkQueue(page, bankOf(ctx.exam, page), session);
  session.rateModules = [];
  session.stage = session.queue.length > 0 ? "questions" : "finished";
  return diagnosisBody(ctx, variant);
}

function addMistakes(ctx: MockContext, variant: Variant): Json {
  const session = sessionFor(ctx);
  const body = isRecord(ctx.body) ? ctx.body : {};
  const ids = strings(body["item_ids"]);
  const open = new Set(mistakeRows(ctx, bankOf(ctx.exam, pageOf(ctx.exam)), session).map((row) => row["item_id"]));
  if (ids.length === 0 || ids.some((id) => !open.has(id))) throw new ApiError("COMMON_VALIDATION", { field: "item_ids" });
  for (const id of ids) session.added.add(id);
  return diagnosisBody(ctx, variant);
}

/** 四种数据各走同一套做法：正常照常，空、受限、数据不足只换上面写明的几项。 */
function withVariants(resolve: (ctx: MockContext, variant: Variant) => Json) {
  return {
    variants: {
      empty: (ctx: MockContext) => resolve(ctx, "empty"),
      restricted: (ctx: MockContext) => resolve(ctx, "restricted"),
      insufficient_data: (ctx: MockContext) => resolve(ctx, "insufficient_data"),
    },
  };
}

export const routes = [
  defineRoute("getDiagnosis", (ctx) => diagnosisBody(ctx, "normal"), withVariants(diagnosisBody)),
  defineRoute("startDiagnosis", (ctx) => start(ctx, "normal"), withVariants(start)),
  defineRoute("submitDiagnosisAnswer", (ctx) => submit(ctx, "normal"), withVariants(submit)),
  defineRoute("pauseDiagnosis", (ctx) => pause(ctx, "normal"), withVariants(pause)),
  defineRoute("resumeDiagnosis", (ctx) => resume(ctx, "normal"), withVariants(resume)),
  defineRoute("switchDiagnosisToQuick", (ctx) => switchQuick(ctx, "normal"), withVariants(switchQuick)),
  defineRoute("submitDiagnosisRatings", (ctx) => rate(ctx, "normal"), withVariants(rate)),
  defineRoute("addDiagnosisMistakes", (ctx) => addMistakes(ctx, "normal"), withVariants(addMistakes)),
];
