// S06 今日的假数据（U06a；api-rules 第 3、4 节）。任务的底子是内存仓库的今日清单（db.todayList：fixtures/exams/ 里的任务，
// 按今天的作答算进度，到期的错题合成“错题回炉”）；页面专用的示例取 fixtures/pages/S06/<考试 ID>.json：理由、一键开始去哪、
// 演示用的完成状态、本页另加的几项任务、换档时长、明天第一件事，以及不可学日与中断回归时的任务。
// 规则还没实现：件数、分钟数、下一项、换档时长只是把演示数据加一加、排一排，整份标 data_source 为 sample。
// 视图：页面在开发与测试时把地址里的 ?view= 传来（查询参数 view）；没传时按数据定——都做完了是“全部完成”，否则是“正常”。
// ?state= 的空、受限、数据不足由下面的 variants 给数据；加载、出错、离线由接口层统一处理（mocks/api.ts），这里不管。
import { param } from "@exam-prep/params";
import { diffDays } from "@exam-prep/shared/today";
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
  readonly reasons?: readonly Reason[];
  readonly polished?: string;
  readonly go?: Json;
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

/** 本页另加的一项：照公共的今日任务的形状补齐（题目、卡片、知识点先留空）。 */
function extraTask(entry: TaskEntry): Json {
  return {
    id: entry.id,
    segment: entry.segment ?? "advance",
    source: entry.source ?? "org_or_custom",
    title: entry.title ?? "",
    minutes: entry.minutes ?? 0,
    status: entry.status ?? "todo",
    question_ids: [],
    card_ids: [],
    knowledge_point_ids: [],
    question_count: 0,
    answered_count: 0,
  };
}

/** 今日清单：内存仓库里的任务（带真进度）补上页面示例，再加上本页另加的几项。 */
function todayRows(ctx: MockContext, page: PageFixture): Row[] {
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
  const extra = page.tasks.filter((entry) => !known.has(entry.id) && entry.title !== undefined).map((entry) => ({ task: extraTask(entry), entry }));
  return [...base, ...extra];
}

function withStatus(row: Row, status: string): Row {
  const answered = status === "done" ? row.task["question_count"] : 0;
  return { ...row, task: { ...row.task, status, answered_count: answered } };
}

/** 各视图的任务：不可学日只留到期复习的最小版，中断回归先给启动任务，首次进入是第一天的清单，全部完成时都已完成。 */
function rowsFor(view: View, rows: readonly Row[], page: PageFixture): Row[] {
  const fresh = (entries: readonly TaskEntry[]): Row[] => entries.map((entry) => ({ task: extraTask(entry), entry }));
  if (view === "off") return fresh(page.off);
  if (view === "back") return fresh(page.back.tasks);
  if (view === "first") return rows.filter((row) => !page.first_skip.includes(String(row.task["segment"]))).map((row) => withStatus(row, "todo"));
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

function home(ctx: MockContext, mode: Mode): Json {
  const page = pageFixture(ctx.exam.examId);
  const all = todayRows(ctx, page);
  const asked = VIEWS.find((view) => view === ctx.query.get("view"));
  const view: View = asked ?? (all.length > 0 && all.every(isFinished) ? "done" : "normal");
  const rows = mode === "empty" ? [] : rowsFor(view, all, page);
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
    ai_paused: aiPaused(mode, view),
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
