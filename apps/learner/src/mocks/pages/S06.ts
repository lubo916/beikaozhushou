// S06 今日的假数据（U06a；api-rules 第 3、4 节）。任务的底子是内存仓库的今日清单（db.todayList：fixtures/exams/ 里的任务，
// 按今天的作答算进度，到期的错题合成“错题回炉”）；页面专用的示例取 fixtures/pages/S06/<考试 ID>.json：理由、一键开始去哪、
// 演示用的完成状态、本页另加的几项任务、换档时长、明天第一件事，以及不可学日与中断回归时的任务。
// 规则还没实现：件数、分钟数、下一项、换档时长只是把演示数据加一加、排一排，整份标 data_source 为 sample。
// 完成看证据：本页另加的任务写了题目的（如待验证复核），进度和清单里其他任务同一口径，按今天在内存仓库里的作答算；
// 演示用的完成状态只在还没作答时套用。所以在做题页把题做完，回到今日这一项就记为已完成，英雄区的“继续”接着指向下一项。
// 视图：页面在开发与测试时把地址里的 ?view= 传来（查询参数 view）；没传时按数据定——都做完了是“全部完成”，否则是“正常”。
// ?state= 的空、受限、数据不足由下面的 variants 给数据；加载、出错、离线由接口层统一处理（mocks/api.ts），这里不管。
// U06b 下半：三个数、计划调整（自动顺延与待确认提议）、节点提醒、收件箱、上手清单与导师恢复时间，取页面示例里的 side。
// 规则还没实现，这些数是演示值；日期按今天往前往后数（演示数据不随真实日期过期）；提议文字里的规则数字按参数填（红线 2）。
// 数据不足时预测与健康度不下结论、只给原始计数；《数据结构》期末故意“体检不通过”，预测锁定（vocabulary 第 9 节）。
import { param } from "@exam-prep/params";
import { formatPercent } from "@exam-prep/shared/format";
import { addDays, diffDays } from "@exam-prep/shared/today";
import { defineRoute, type MockContext } from "../route.ts";

type Json = Record<string, unknown>;
type Mode = "normal" | "empty" | "restricted" | "insufficient_data";
type View = "normal" | "first" | "done" | "off" | "back" | "noai";

const VIEWS: readonly View[] = ["normal", "first", "done", "off", "back", "noai"];
const SEGMENTS = ["consolidate", "advance", "closing"] as const;
/** 不用再做的：有证据的完成，或手动勾选的“看过”。 */
const FINISHED: ReadonlySet<unknown> = new Set(["done", "seen"]);
/** 页面示例里没写顺序的任务排在本段最后。 */
const LAST = Number.MAX_SAFE_INTEGER;
/** 首次进入的那天是第几天。 */
const FIRST_DAY_NO = 1;
/** 上手清单六项（vocabulary 第 4 节）。 */
const ONBOARDING_STEPS = ["goal", "materials", "diagnosis", "today", "annotate", "ask_tutor"] as const;
const MS_PER_HOUR = 60 * 60 * 1000;
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

interface Reason {
  readonly kind: string;
  readonly [field: string]: unknown;
}

/** 页面示例里的一条任务：id 对上今日清单里已有的任务时，只补理由、去向与演示状态；对不上时是本页另加的一项。 */
interface TaskEntry {
  readonly id: string;
  readonly order?: number;
  readonly status?: string;
  readonly segment?: string;
  readonly source?: string;
  readonly title?: string;
  readonly minutes?: number;
  /** 这一项的题（如待验证复核要换个问法再考的题）：进度按今天在内存仓库里的作答算。 */
  readonly question_ids?: readonly string[];
  readonly reasons?: readonly Reason[];
  readonly polished?: string;
  readonly go?: Json;
}

/** 页面示例里的一次自动顺延：日期按今天往前数（moved_offset 是哪天凌晨挪的，from_offset 是原定哪天）。 */
interface CarryoverEntry {
  readonly id: string;
  readonly title: string;
  readonly spent_minutes?: number;
  readonly from_offset: number;
  readonly moved_offset: number;
}

/** 页面示例里的一条提议：四行文字里的 {{weeks}}、{{gap}}、{{days}}、{{away_days}} 由这里按参数与这次的数填好。 */
interface ProposalEntry {
  readonly id: string;
  readonly kind: string;
  readonly days?: number;
  readonly ai_generated: boolean;
  readonly source?: string;
  readonly hours_ago: number;
  readonly change: string;
  readonly reason: string;
  readonly cost: string;
  readonly if_declined: string;
}

/** 页面示例里的一个节点：日期按今天往后数 in_days 天。 */
interface MilestoneEntry {
  readonly kind: string;
  readonly in_days: number;
  readonly status: string;
  readonly basis?: string;
}

/** 右栏与各视图专属部件的演示数据（U06b）。 */
interface SideFixture {
  /** 三个数，形状同接口（S06Metrics）。 */
  readonly metrics: Json;
  /** 数据不足时预测与健康度的原始计数（S06Shortfall）。 */
  readonly insufficient: Readonly<Record<string, Json>>;
  readonly carryovers: readonly CarryoverEntry[];
  readonly proposals: readonly ProposalEntry[];
  readonly restart_proposal?: ProposalEntry;
  readonly milestones?: { readonly window_days: number; readonly items: readonly MilestoneEntry[] };
  readonly inbox?: Json;
  readonly onboarding: { readonly done: readonly string[]; readonly collapse_at: number };
  readonly ai_eta_minutes?: number;
}

/** fixtures/pages/S06/<考试 ID>.json。 */
interface PageFixture {
  readonly week: number;
  readonly date_estimated: boolean;
  readonly capped: boolean;
  readonly tiers: { readonly lite: number; readonly minimal: number };
  readonly minutes_spent: number;
  readonly tomorrow_first?: Json;
  readonly first_skip: readonly string[];
  readonly tasks: readonly TaskEntry[];
  readonly off: readonly TaskEntry[];
  readonly back: { readonly away_days: number; readonly tasks: readonly TaskEntry[] };
  readonly side?: SideFixture;
}

interface Row {
  readonly task: Json;
  readonly entry: TaskEntry | undefined;
}

const FILES = import.meta.glob("../../../../../fixtures/pages/S06/*.json", { eager: true, import: "default" });

/** 新加的演示考试还没有页面示例时用的演示值。 */
const NO_PAGE: PageFixture = {
  week: FIRST_DAY_NO,
  date_estimated: false,
  capped: false,
  tiers: { lite: 0, minimal: 0 },
  minutes_spent: 0,
  first_skip: [],
  tasks: [],
  off: [],
  back: { away_days: FIRST_DAY_NO, tasks: [] },
};

/** 新加的演示考试还没有右栏示例时：三个数先不下结论，其余都没有。 */
const NO_SIDE: SideFixture = {
  metrics: {
    forecast_gap: { status: "insufficient", shortfall: { have: 0, missing: FIRST_DAY_NO } },
    completion: { status: "ok", ratio: 0 },
    health: { status: "insufficient", shortfall: { have: 0, missing: FIRST_DAY_NO } },
  },
  insufficient: {},
  carryovers: [],
  proposals: [],
  onboarding: { done: [], collapse_at: ONBOARDING_STEPS.length },
};

/** 一键开始默认去哪（页面示例里没写时）：复习去复习与卡片，新学去阅读器，口述回顾去背诵训练，其余去做题。 */
const GO_BY_SOURCE: Readonly<Record<string, Json>> = {
  due_review: { page: "S15" },
  new_learning: { page: "S12" },
  bedtime_review: { page: "S16" },
};
const GO_DEFAULT: Json = { page: "S18" };

const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const isFinished = (row: Row): boolean => FINISHED.has(row.task["status"]);
const orderOf = (row: Row): number => row.entry?.order ?? LAST;
const minutesOf = (rows: readonly Row[]): number => rows.reduce((total, row) => total + Number(row.task["minutes"] ?? 0), 0);

function pageFixture(examId: string): PageFixture {
  const hit = Object.entries(FILES).find(([path]) => path.endsWith(`/${examId}.json`));
  return hit === undefined ? NO_PAGE : (hit[1] as PageFixture);
}

/** 今天已作答的题：内存仓库里只追加的作答记录（今日清单算进度用的也是这一份）。 */
function answeredToday(ctx: MockContext): ReadonlySet<string> {
  const attempts = ctx.db.attempts(ctx.exam.examId).filter((attempt) => attempt.day === ctx.day);
  return new Set(attempts.map((attempt) => attempt.questionId));
}

/** 本页另加的一项：照公共的今日任务的形状补齐（卡片、知识点先留空）。写了题目的，和今日清单里的任务同一口径：
 * 一道没答是待做，答了一部分是进行中，都答了是完成（完成看证据）；演示用的完成状态只在还没作答时套用。 */
function extraTask(entry: TaskEntry, answered: ReadonlySet<string>): Json {
  const questions = entry.question_ids ?? [];
  const count = questions.filter((id) => answered.has(id)).length;
  const progress = count === 0 ? "todo" : count < questions.length ? "in_progress" : "done";
  return {
    id: entry.id,
    segment: entry.segment ?? "advance",
    source: entry.source ?? "org_or_custom",
    title: entry.title ?? "",
    minutes: entry.minutes ?? 0,
    status: progress === "todo" ? (entry.status ?? "todo") : progress,
    question_ids: [...questions],
    card_ids: [],
    knowledge_point_ids: [],
    question_count: questions.length,
    answered_count: count,
  };
}

/** 今日清单：内存仓库里的任务（带真进度）补上页面示例，再加上本页另加的几项。 */
function todayRows(ctx: MockContext, page: PageFixture, answered: ReadonlySet<string>): Row[] {
  const entries = new Map(page.tasks.map((entry) => [entry.id, entry]));
  const list: unknown = ctx.db.todayList(ctx.exam, ctx.day);
  const groups = isRecord(list) && Array.isArray(list["segments"]) ? (list["segments"] as unknown[]) : [];
  const base = groups
    .flatMap((group) => (isRecord(group) && Array.isArray(group["tasks"]) ? (group["tasks"] as unknown[]) : []))
    .filter(isRecord)
    .map((task): Row => {
      const entry = entries.get(String(task["id"]));
      // 演示用的完成状态只套在还没开始的任务上；内存仓库里有了真进度，以真进度为准
      const demo = task["status"] === "todo" && entry?.title === undefined ? entry?.status : undefined;
      return { task: demo === undefined ? task : { ...task, status: demo }, entry };
    });
  const known = new Set(base.map((row) => String(row.task["id"])));
  const extra = page.tasks
    .filter((entry) => !known.has(entry.id) && entry.title !== undefined)
    .map((entry) => ({ task: extraTask(entry, answered), entry }));
  return [...base, ...extra];
}

function withStatus(row: Row, status: string): Row {
  const answered = status === "done" ? row.task["question_count"] : 0;
  return { ...row, task: { ...row.task, status, answered_count: answered } };
}

/** 各视图的任务：不可学日只留到期复习的最小版，中断回归先给启动任务，首次进入是第一天的清单，全部完成时都已完成。 */
function rowsFor(view: View, rows: readonly Row[], page: PageFixture, answered: ReadonlySet<string>): Row[] {
  const fresh = (entries: readonly TaskEntry[]): Row[] => entries.map((entry) => ({ task: extraTask(entry, answered), entry }));
  const firstDay = (row: Row): boolean => !page.first_skip.includes(String(row.task["segment"]));
  if (view === "off") return fresh(page.off);
  if (view === "back") return fresh(page.back.tasks);
  if (view === "first") return rows.filter(firstDay).map((row) => withStatus(row, "todo"));
  if (view === "done") return rows.map((row) => withStatus(row, "done"));
  return [...rows];
}

/** 理由里的规则数字与服务端取同一份：不可学日顺延时找空位的天数取参数；中断回归取这次中断的天数。 */
function fillReason(reason: Reason, awayDays: number): Json {
  if (reason.kind === "off_day_moved") return { ...reason, days: param("plan.carryover.search_days") };
  if (reason.kind === "restart_due") return { ...reason, days: awayDays };
  return { ...reason };
}

function item(row: Row, polish: boolean, awayDays: number): Json {
  const entry = row.entry;
  const polished = polish ? entry?.polished : undefined;
  return {
    task: row.task,
    reasons: (entry?.reasons ?? []).map((reason) => fillReason(reason, awayDays)),
    ...(polished === undefined ? {} : { polished }),
    go: entry?.go ?? GO_BY_SOURCE[String(row.task["source"])] ?? GO_DEFAULT,
  };
}

/** 剩下的任务换成三档各要多少分钟（演示值不超过剩下的时长）。 */
function tiers(remaining: number, page: PageFixture): Json {
  return {
    current: "full",
    options: [
      { tier: "full", minutes: remaining },
      { tier: "lite", minutes: Math.min(page.tiers.lite, remaining) },
      { tier: "minimal", minutes: Math.min(page.tiers.minimal, remaining) },
    ],
  };
}

function aiPaused(mode: Mode, view: View): string {
  if (mode === "restricted") return "quota";
  return view === "noai" ? "unavailable" : "none";
}

/** 文字里的占位符按给的值填好（规则数字只从参数来，红线 2）。 */
function fillText(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(PLACEHOLDER, (whole: string, name: string) => (values[name] === undefined ? whole : String(values[name])));
}

/** 三个数：数据不足时预测与健康度不下结论，只给原始计数（演示值），完成度照常；预测已锁定（地图体检不通过）的照样锁定。 */
function metricsOf(side: SideFixture, mode: Mode): Json {
  if (mode !== "insufficient_data") return side.metrics;
  const short = (key: string): Json => ({
    status: "insufficient",
    shortfall: side.insufficient[key] ?? { have: 0, missing: FIRST_DAY_NO },
  });
  const forecast = side.metrics["forecast_gap"];
  const locked = isRecord(forecast) && forecast["status"] === "locked";
  return { ...side.metrics, forecast_gap: locked ? forecast : short("forecast_gap"), health: short("health") };
}

/** 一条待确认的提议（公共的 Proposal 加上本页的种类与 AI 标识）：四行文字里的规则数字按参数填，中断天数取这次的。 */
function proposalOf(ctx: MockContext, entry: ProposalEntry, awayDays: number): Json {
  const values = {
    weeks: param("plan.calibrate.weeks"),
    gap: formatPercent(param("plan.calibrate.gap_ratio")),
    days: entry.days ?? 0,
    away_days: awayDays,
  };
  return {
    kind: entry.kind,
    ...(entry.days === undefined ? {} : { days: entry.days }),
    ai_generated: entry.ai_generated,
    proposal: {
      id: entry.id,
      exam_id: ctx.exam.examId,
      status: "pending",
      source: entry.source ?? "planner",
      change: fillText(entry.change, values),
      reason: fillText(entry.reason, values),
      cost: fillText(entry.cost, values),
      if_declined: fillText(entry.if_declined, values),
      created_at: new Date(ctx.now - entry.hours_ago * MS_PER_HOUR).toISOString(),
    },
  };
}

/** 一次自动顺延：挪到今天；参数 plan.proposal.undo_days 天内可撤销。 */
function carryoverOf(ctx: MockContext, entry: CarryoverEntry): Json {
  const movedOn = addDays(ctx.day, entry.moved_offset);
  return {
    id: entry.id,
    moved_on: movedOn,
    from_day: addDays(ctx.day, entry.from_offset),
    to_day: ctx.day,
    title: entry.title,
    ...(entry.spent_minutes === undefined ? {} : { spent_minutes: entry.spent_minutes }),
    undo_until: `${addDays(movedOn, param("plan.proposal.undo_days"))}T00:00:00Z`,
  };
}

/** 节点提醒：只给离今天不超过 window_days 天的（窗口天数的参数待登记，先用演示值）；一个都没有就不给。 */
function milestonesOf(ctx: MockContext, side: SideFixture): Json | undefined {
  const window = side.milestones;
  if (window === undefined) return undefined;
  const items = window.items
    .filter((entry) => entry.in_days >= 0 && entry.in_days <= window.window_days)
    .map((entry) => ({
      kind: entry.kind,
      date: addDays(ctx.day, entry.in_days),
      status: entry.status,
      ...(entry.basis === undefined ? {} : { basis: entry.basis }),
    }));
  return items.length === 0 ? undefined : { window_days: window.window_days, items };
}

/** 上手清单：六项逐项打勾；再完成几项就自动收起（收起项数的参数待登记，先用演示值）。 */
function onboardingOf(side: SideFixture): Json {
  const done = new Set(side.onboarding.done);
  const items = ONBOARDING_STEPS.map((step) => ({ step, done: done.has(step) }));
  const finished = items.filter((entry) => entry.done).length;
  return { items, collapse_in: Math.max(0, side.onboarding.collapse_at - finished) };
}

/** 右栏与各视图专属部件（U06b）：首次进入有上手清单、还没有计划调整与收件箱；中断回归另给重组提议；导师不可用给恢复时间。 */
function sideOf(ctx: MockContext, page: PageFixture, view: View, mode: Mode, paused: string): Json {
  const side = page.side ?? NO_SIDE;
  const first = view === "first";
  const planned = mode !== "empty";
  const awayDays = page.back.away_days;
  const carryovers = side.carryovers.map((entry) => carryoverOf(ctx, entry));
  const proposals = side.proposals.map((entry) => proposalOf(ctx, entry, awayDays));
  const adjust = planned && !first && carryovers.length + proposals.length > 0;
  const restart = planned && view === "back" ? side.restart_proposal : undefined;
  const milestones = planned ? milestonesOf(ctx, side) : undefined;
  return {
    metrics: metricsOf(side, mode),
    ...(adjust ? { adjustments: { carryovers, proposals } } : {}),
    ...(restart === undefined ? {} : { restart_proposal: proposalOf(ctx, restart, awayDays) }),
    ...(milestones === undefined ? {} : { milestones }),
    ...(planned && !first && side.inbox !== undefined ? { inbox: side.inbox } : {}),
    ...(first ? { onboarding: onboardingOf(side) } : {}),
    ...(paused === "unavailable" && side.ai_eta_minutes !== undefined ? { ai_eta_minutes: side.ai_eta_minutes } : {}),
  };
}

function home(ctx: MockContext, mode: Mode): Json {
  const page = pageFixture(ctx.exam.examId);
  const answered = answeredToday(ctx);
  const all = todayRows(ctx, page, answered);
  const asked = VIEWS.find((view) => view === ctx.query.get("view"));
  const view: View = asked ?? (all.length > 0 && all.every(isFinished) ? "done" : "normal");
  const rows = mode === "empty" ? [] : rowsFor(view, all, page, answered);
  const polish = view !== "noai" && mode !== "restricted";
  const awayDays = page.back.away_days;
  const bySegment = SEGMENTS.map((segment) => ({
    segment,
    rows: rows.filter((row) => row.task["segment"] === segment).sort((a, b) => orderOf(a) - orderOf(b)),
  }));
  const ordered = bySegment.flatMap((group) => group.rows);
  const open = ordered.filter((row) => !isFinished(row));
  const finished = ordered.filter(isFinished);
  const next = open.find((row) => row.task["status"] === "in_progress") ?? open[0];
  const remaining = minutesOf(open);
  const plan = ctx.exam.learner.plan;
  const showTiers = view !== "off" && view !== "back" && remaining > 0;
  const paused = aiPaused(mode, view);
  return {
    view,
    day: ctx.day,
    ...(view === "first"
      ? { day_no: FIRST_DAY_NO }
      : { round: { index: Number(plan["round_index"] ?? FIRST_DAY_NO), name: String(plan["round_name"] ?? ""), week: page.week } }),
    countdown: { days: Math.max(0, diffDays(ctx.day, ctx.exam.learner.goal.target_date)), estimated: page.date_estimated },
    summary: {
      task_count: ordered.length,
      done_count: finished.length,
      minutes_total: minutesOf(ordered),
      minutes_spent: view === "done" ? page.minutes_spent : minutesOf(finished),
    },
    ...(next === undefined ? {} : { next_task_id: next.task["id"] }),
    budget: { mix_mode: plan["mix_mode"] ?? "roi", floor_ratio: param("plan.consolidate.min_ratio") },
    segments: bySegment.map((group) => ({
      segment: group.segment,
      minutes: minutesOf(group.rows),
      capped: group.segment === "consolidate" && page.capped && (view === "normal" || view === "noai") && group.rows.length > 0,
      items: group.rows.map((row) => item(row, polish, awayDays)),
    })),
    ...(showTiers ? { tiers: tiers(remaining, page) } : {}),
    ...(view === "done" && page.tomorrow_first !== undefined ? { tomorrow_first: page.tomorrow_first } : {}),
    ...(view === "back" ? { away_days: awayDays } : {}),
    pace: mode === "insufficient_data" ? "typical" : "measured",
    ai_paused: paused,
    ...sideOf(ctx, page, view, mode, paused),
    data_source: "sample",
  };
}

export const routes = [
  defineRoute("getTodayHome", (ctx) => home(ctx, "normal"), {
    variants: {
      empty: (ctx) => home(ctx, "empty"),
      restricted: (ctx) => home(ctx, "restricted"),
      insufficient_data: (ctx) => home(ctx, "insufficient_data"),
    },
  }),
];
