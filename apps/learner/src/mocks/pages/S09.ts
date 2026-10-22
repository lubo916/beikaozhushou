// S09 知识地图的假数据（U09；api-rules 第 3、4 节）。章、示例知识点、示例知识点的掌握档与今日任务取 fixtures/exams/；
// 其余格子与六种着色要用的值（目标档、考情级、遗忘风险、性价比阶梯、资料覆盖、标记、所在层）取 fixtures/pages/S09/<考试 ID>.json，
// 那里逐格写好，这里只解码与计数。规则还没实现：已学、已达标等计数只是把演示数据数一遍，整份标 data_source 为 sample。
// ?state= 的空、受限、数据不足、锁定由下面的 variants 给数据；加载、出错、离线由接口层统一处理（mocks/api.ts），这里不管。
import type { ChapterFixture, DemoExam, PointFixture } from "../demo.ts";
import { defineRoute, type MockContext } from "../route.ts";

type Json = Record<string, unknown>;
type Mode = "normal" | "empty" | "restricted" | "insufficient_data" | "locked";

/** 一个示例知识点的着色值（档位、证据与范围取 fixtures/exams 的 learner.json）。 */
interface NamedExtra {
  readonly importance: number;
  readonly exam_level: number | null;
  readonly forgetting_risk: string | null;
  readonly roi_tier: string | null;
  readonly material: string;
  readonly flags: readonly string[];
  readonly self_level?: number;
}

/** 一章里示例知识点以外的格子：每个串逐格对应（第 k 个字符就是第 k 格）。 */
interface ChapterCells {
  /** 0–5 档位（证据足）；a–e 为 1–5 档且有待验证的作答；x 证据不足；/ 范围外。 */
  readonly cells: string;
  /** 目标档 0–5。 */
  readonly target: string;
  /** 知识类型代号，见 TYPE_CODES。 */
  readonly types: string;
  /** 重要度 1–4。 */
  readonly importance: string;
  /** 考情级 1–4；0 为考情数据还不够。 */
  readonly exam_level: string;
  /** 遗忘风险：h 高、m 中、l 低、- 不给。 */
  readonly forgetting: string;
  /** 性价比阶梯 s a b c d；- 不给。 */
  readonly roi: string;
  /** 资料覆盖：r 能在阅读器里读、m 只有页码或链接、n 没有。 */
  readonly material: string;
  /** 标记（十六进制位）：1 薄弱、2 高频、4 待复习、8 有错题。 */
  readonly flags: string;
  /** 所在层：b 底图、o 机构扩展层、p 个人扩展层。 */
  readonly layers: string;
  readonly collapsed?: boolean;
}

interface EdgeFixture {
  readonly from: string;
  readonly to: string;
  readonly type: string;
  readonly strength: string;
  readonly origin: string;
  readonly confidence?: number;
  readonly high_confidence?: boolean;
}

interface PageFixture {
  readonly org_name: string | null;
  readonly typing_ratio: number;
  readonly health: Json;
  readonly named: Readonly<Record<string, NamedExtra>>;
  readonly chapters: Readonly<Record<string, ChapterCells>>;
  readonly relations: { readonly center_id: string; readonly edges: readonly EdgeFixture[] };
}

/** 解码后的一格（只在这里用；输出前换成契约里的字段名）。 */
interface Cell {
  readonly id: string;
  readonly name: string;
  readonly types: readonly string[];
  readonly layer: string;
  readonly level: number;
  readonly self?: number;
  readonly target?: number;
  readonly sufficient: boolean;
  readonly pending: boolean;
  readonly inScope: boolean;
  /** 有过任一证据（已学）。 */
  readonly hasEvidence: boolean;
  readonly importance: number;
  readonly examLevel?: number;
  readonly risk?: string;
  readonly roi?: string;
  readonly material: string;
  readonly flags: readonly string[];
}

const FILES = import.meta.glob("../../../../../fixtures/pages/S09/*.json", { eager: true, import: "default" });

/** 新加的演示考试还没有页面示例时用：只有示例知识点。 */
const NO_PAGE: PageFixture = {
  org_name: null,
  typing_ratio: 1,
  health: { passed: true, default_pass: false, issues: [] },
  named: {},
  chapters: {},
  relations: { center_id: "", edges: [] },
};

/** ?state=locked 时的体检结果（演示值）：一项阻断，性价比阶梯锁定。 */
const LOCKED_HEALTH: Json = { passed: false, default_pass: false, issues: [{ kind: "question_coverage", severity: "blocking", count: 1 }] };
const EMPTY_HEALTH: Json = { passed: true, default_pass: false, issues: [] };

const TYPE_CODES: Readonly<Record<string, string>> = {
  c: "concept",
  f: "fact",
  s: "statute",
  p: "procedure",
  a: "application",
  e: "essay",
  o: "oral",
  r: "practical",
};
const RISKS: Readonly<Record<string, string>> = { h: "high", m: "medium", l: "low" };
const MATERIALS: Readonly<Record<string, string>> = { r: "readable", m: "mapped", n: "none" };
const LAYERS: Readonly<Record<string, string>> = { b: "base", o: "org", p: "personal" };
const FLAG_BITS: readonly (readonly [number, string])[] = [
  [1, "weak"],
  [2, "high_frequency"],
  [4, "due_review"],
  [8, "has_mistakes"],
];
const PENDING_CODES = "abcde";
const HEX = 16;
const MAIN_TYPE_COUNT = 4;

function pageFixture(examId: string): PageFixture {
  const hit = Object.entries(FILES).find(([path]) => path.endsWith(`/${examId}.json`));
  return hit === undefined ? NO_PAGE : (hit[1] as PageFixture);
}

/** 占位格的 ID：同一章、同一考试里唯一，格式照 UUIDv7（版本位 7、变体位 8）。 */
function fillerId(chapter: ChapterFixture, index: number): string {
  const parts = chapter.id.split("-");
  const head = (parts[0] ?? "").slice(0, 6);
  const tail = (parts[4] ?? "").slice(-4);
  return `${head}f9-${tail}-7000-8000-${index.toString(HEX).padStart(12, "0")}`;
}

function namedCell(exam: DemoExam, point: PointFixture, extra: NamedExtra | undefined): Cell {
  const mastery = exam.learner.mastery.find((m) => m.knowledge_point_id === point.id);
  const level = mastery?.level ?? 0;
  const sufficient = mastery?.evidence_sufficient ?? true;
  const target = mastery?.target_level ?? point.default_target_level ?? undefined;
  return {
    id: point.id,
    name: point.name,
    types: [...point.knowledge_types],
    layer: "base",
    level,
    ...(extra?.self_level === undefined ? {} : { self: extra.self_level }),
    ...(target === undefined ? {} : { target }),
    sufficient,
    pending: mastery?.pending_verification ?? false,
    inScope: mastery?.in_scope ?? true,
    hasEvidence: level > 0 || !sufficient,
    importance: extra?.importance ?? 2,
    ...(extra?.exam_level === null || extra?.exam_level === undefined ? {} : { examLevel: extra.exam_level }),
    ...(extra?.forgetting_risk === null || extra?.forgetting_risk === undefined ? {} : { risk: extra.forgetting_risk }),
    ...(extra?.roi_tier === null || extra?.roi_tier === undefined ? {} : { roi: extra.roi_tier }),
    material: extra?.material ?? "mapped",
    flags: [...(extra?.flags ?? [])],
  };
}

function fillerCells(chapter: ChapterFixture, chapterNo: number, cells: ChapterCells | undefined, firstNo: number): Cell[] {
  if (cells === undefined) return [];
  return [...cells.cells].map((code, k): Cell => {
    const pending = PENDING_CODES.includes(code);
    const inScope = code !== "/";
    let level = Number(code);
    if (pending) level = PENDING_CODES.indexOf(code) + 1;
    else if (code === "x") level = 1;
    else if (!inScope) level = 0;
    const examLevel = Number(cells.exam_level.charAt(k));
    const risk = RISKS[cells.forgetting.charAt(k)];
    const roi = cells.roi.charAt(k);
    const bits = Number.parseInt(cells.flags.charAt(k) || "0", HEX);
    const type = TYPE_CODES[cells.types.charAt(k)] ?? "concept";
    return {
      id: fillerId(chapter, k + 1),
      name: `示例知识点 ${chapterNo}-${firstNo + k}`,
      types: [type],
      layer: LAYERS[cells.layers.charAt(k)] ?? "base",
      level,
      target: Number(cells.target.charAt(k)),
      sufficient: code !== "x",
      pending,
      inScope,
      hasEvidence: code !== "0" && inScope,
      importance: Number(cells.importance.charAt(k)) || 1,
      ...(examLevel > 0 ? { examLevel } : {}),
      ...(risk === undefined ? {} : { risk }),
      ...(roi === "-" || roi === "" ? {} : { roi }),
      material: MATERIALS[cells.material.charAt(k)] ?? "mapped",
      flags: FLAG_BITS.filter(([bit]) => (bits & bit) !== 0).map(([, flag]) => flag),
    };
  });
}

/** 按 ?state= 改一格：数据不足时有证据的格子都算证据不足；锁定时不给性价比阶梯。 */
function effective(cell: Cell, mode: Mode): Cell {
  if (mode === "insufficient_data" && cell.hasEvidence && cell.inScope) return { ...cell, sufficient: false };
  if (mode === "locked" && cell.roi !== undefined) {
    const { roi: _dropped, ...rest } = cell;
    return rest;
  }
  return cell;
}

const reachedOf = (cell: Cell): boolean => cell.inScope && cell.sufficient && cell.target !== undefined && cell.level >= cell.target;

function pointJson(cell: Cell): Json {
  return {
    id: cell.id,
    name: cell.name,
    knowledge_types: [...cell.types],
    layer: cell.layer,
    level: cell.level,
    ...(cell.self === undefined ? {} : { self_level: cell.self }),
    ...(cell.target === undefined ? {} : { target_level: cell.target, gap: cell.target - cell.level }),
    reached: reachedOf(cell),
    evidence_sufficient: cell.sufficient,
    pending_verification: cell.pending,
    in_scope: cell.inScope,
    importance: cell.importance,
    ...(cell.examLevel === undefined ? {} : { exam_level: cell.examLevel }),
    ...(cell.risk === undefined ? {} : { forgetting_risk: cell.risk }),
    ...(cell.roi === undefined ? {} : { roi_tier: cell.roi }),
    material: cell.material,
    flags: [...cell.flags],
  };
}

function relations(page: PageFixture, all: readonly Cell[]): Json {
  const names = new Map(all.map((cell) => [cell.id, cell.name]));
  const edges = page.relations.edges.filter((edge) => names.has(edge.from) && names.has(edge.to));
  const ids = [...new Set(edges.flatMap((edge) => [edge.from, edge.to]))];
  const center = names.has(page.relations.center_id) ? page.relations.center_id : undefined;
  return {
    ...(center === undefined ? {} : { center_id: center }),
    nodes: ids.map((id) => ({ id, name: names.get(id) ?? "" })),
    edges: edges.map((edge) => ({ ...edge })),
  };
}

/** 地图来源四行：底图按地图来源记在官方、模板或我的（自建）；扩展层分机构与个人。 */
function sources(exam: DemoExam, page: PageFixture, all: readonly Cell[]): Json[] {
  const layer = (name: string): number => all.filter((cell) => cell.layer === name).length;
  const base = layer("base");
  const org = layer("org");
  const custom = exam.map.source === "custom";
  const mine = (custom ? base : 0) + layer("personal");
  const count = (n: number): Json => (n > 0 ? { count: n } : {});
  return [
    { kind: "official", ...count(exam.map.source === "official" ? base : 0) },
    { kind: "org", ...count(org), ...(org > 0 && page.org_name !== null ? { org_name: page.org_name } : {}) },
    { kind: "template", ...count(exam.map.source === "template" ? base : 0) },
    { kind: "mine", ...count(mine), mine_custom: custom },
  ];
}

function mainTypes(all: readonly Cell[]): string[] {
  const tally = new Map<string, number>();
  for (const cell of all) for (const type of cell.types) tally.set(type, (tally.get(type) ?? 0) + 1);
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAIN_TYPE_COUNT)
    .map(([type]) => type);
}

function overview(ctx: MockContext, mode: Mode): Json {
  const { exam } = ctx;
  const page = pageFixture(exam.examId);
  const empty = mode === "empty";
  const chapters = empty
    ? []
    : exam.map.chapters.map((chapter, index) => {
        const named = chapter.sample_points.map((point) => namedCell(exam, point, page.named[point.id]));
        const filler = fillerCells(chapter, index + 1, page.chapters[chapter.id], named.length + 1);
        return { chapter, cells: [...named, ...filler].map((cell) => effective(cell, mode)), collapsed: page.chapters[chapter.id]?.collapsed ?? false };
      });
  const all = chapters.flatMap((entry) => entry.cells);
  const inScope = all.filter((cell) => cell.inScope);
  const count = (list: readonly Cell[], test: (cell: Cell) => boolean): number => list.filter(test).length;
  const ids = new Set(all.map((cell) => cell.id));
  const focus = exam.learner.today_tasks.flatMap((task) => task.knowledge_point_ids).find((id) => ids.has(id)) ?? all[0]?.id;
  let health = page.health;
  if (mode === "locked") health = LOCKED_HEALTH;
  else if (empty) health = EMPTY_HEALTH;
  return {
    map: { map_id: exam.map.map_id, exam_id: exam.examId, source: exam.map.source, version: exam.map.map_version },
    access: mode === "restricted" ? "extension_only" : "full",
    evidence_sufficient: mode !== "insufficient_data",
    stats: { learned: count(all, (cell) => cell.hasEvidence), reached: count(all, reachedOf), in_scope: inScope.length, total: all.length },
    attention: {
      evidence_insufficient: count(inScope, (cell) => !cell.sufficient),
      pending_verification: count(inScope, (cell) => cell.pending),
      no_material: count(inScope, (cell) => cell.material === "none"),
    },
    chapters: chapters.map(({ chapter, cells, collapsed }) => {
      const reached = count(cells, reachedOf);
      return {
        id: chapter.id,
        name: chapter.name,
        total: cells.length,
        reached,
        reached_ratio: cells.length === 0 ? 0 : reached / cells.length,
        collapsed_by_default: collapsed,
        points: cells.map(pointJson),
      };
    }),
    ...(focus === undefined ? {} : { focus_point_id: focus }),
    relations: empty ? { nodes: [], edges: [] } : relations(page, all),
    sources: sources(exam, page, all),
    typing: { ratio: empty ? 0 : page.typing_ratio, main_types: mainTypes(all) },
    health,
    data_source: "sample",
  };
}

export const routes = [
  defineRoute("getKnowledgeMapOverview", (ctx) => overview(ctx, "normal"), {
    variants: {
      empty: (ctx) => overview(ctx, "empty"),
      restricted: (ctx) => overview(ctx, "restricted"),
      insufficient_data: (ctx) => overview(ctx, "insufficient_data"),
      locked: (ctx) => overview(ctx, "locked"),
    },
  }),
];
