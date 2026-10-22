// S29-01/02/03/04：只读示例检索。拼音、模糊与自然语言以别名演示，不冒充真实语义检索。
// 考试按请求里的 exam_id 取（查询键随之按考试分开，切换考试不串数据）；没带时用开发工具条当前的演示考试，不认识的考试回 404。
// 示例引用（知识点、资料、题目、笔记、速查表行）都取考试地图与学员资料里真实存在的条目，由 S29 回归测试锁定。
import type { S29QuickTable, S29Result, S29SearchPage } from "@exam-prep/contract";
import copy from "../../i18n/zh-CN/S29.json";
import type { DemoExam } from "../demo.ts";
import { defineRoute, type MockContext } from "../route.ts";

interface PageFixture {
  readonly sample_query: string;
  readonly aliases: readonly string[];
  readonly point_id: string;
  readonly excerpt: string;
  readonly material_id: string;
  readonly question_id: string;
  readonly quick_tables: S29QuickTable[];
}
type Mode = S29SearchPage["state_hint"];
type Kind = S29Result["kind"];

const FILES = import.meta.glob<PageFixture>("../../../../../fixtures/pages/S29/*.json", { eager: true, import: "default" });
const KINDS: readonly Kind[] = ["point", "material", "question", "note", "mistake", "tutor"];
const TARGET: Readonly<Record<Kind, S29Result["target"]>> = {
  point: "S10",
  material: "S12",
  question: "S18",
  note: "S14",
  mistake: "S18",
  tutor: "S28",
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
const textOf = (value: unknown, fallback: string): string => (typeof value === "string" ? value : fallback);
const squash = (text: string): string => text.toLocaleLowerCase().replace(/\s/g, "");

function examOf(ctx: MockContext): DemoExam {
  const examId = ctx.query.get("exam_id");
  return examId === null || examId === "" ? ctx.exam : ctx.db.examById(examId);
}

export function searchPage(ctx: MockContext, mode: Mode = "normal"): S29SearchPage {
  const exam = examOf(ctx);
  const fixture = Object.entries(FILES).find(([path]) => path.endsWith(`/${exam.examId}.json`))?.[1];
  if (fixture === undefined) throw new Error(`S29 缺少演示考试 ${exam.examId} 的页面数据`);
  const query = mode === "empty" ? "" : (ctx.query.get("q") ?? fixture.sample_query).trim();
  const point = exam.map.chapters.flatMap((chapter) => chapter.sample_points).find((item) => item.id === fixture.point_id);
  const material = exam.learner.materials.map(asRecord).find((item) => item?.["id"] === fixture.material_id);
  const note = exam.learner.notes.map(asRecord).find((item) => {
    const ids = item?.["knowledge_point_ids"];
    return Array.isArray(ids) && ids.includes(fixture.point_id);
  });
  const question = exam.questions.find((item) => item.id === fixture.question_id);
  if (point === undefined || material === undefined || question === undefined) {
    throw new Error(`S29 演示数据引用不到 ${exam.examId} 的知识点、资料或题目`);
  }
  const rows: S29Result[] = KINDS.map(
    (kind): S29Result => ({
      id:
        kind === "question" || kind === "mistake"
          ? fixture.question_id
          : kind === "material"
            ? fixture.material_id
            : kind === "note"
              ? textOf(note?.["id"], fixture.point_id)
              : fixture.point_id,
      kind,
      title:
        kind === "material"
          ? textOf(material["title"], point.name)
          : kind === "question" || kind === "mistake"
            ? question.stem
            : kind === "note"
              ? textOf(note?.["title"], point.name)
              : point.name,
      excerpt: kind === "note" ? textOf(note?.["body"], fixture.excerpt) : fixture.excerpt,
      source: kind === "point" ? exam.profile.name : copy.kind[kind],
      target: TARGET[kind],
      // 作答、笔记本与导师的路由不带内容 ID（作答用路由表的 demo 会话），不把题目 ID 当会话。
      target_id: kind === "point" ? fixture.point_id : kind === "material" ? fixture.material_id : "demo",
      ai_generated: kind === "tutor" || (kind === "note" && note?.["ai_generated"] === true),
    }),
  );
  const normalized = squash(query);
  const matching =
    normalized !== "" &&
    fixture.aliases.some((alias) => {
      const known = squash(alias);
      return known.includes(normalized) || normalized.includes(known);
    });
  const askedKind = ctx.query.get("kind") ?? "all";
  const found = mode !== "insufficient_data" && matching ? rows.filter((row) => askedKind === "all" || row.kind === askedKind) : [];
  const tables = query !== "" && !matching ? [] : fixture.quick_tables;
  // 右栏默认是和关键词相关的那张速查表（含示例知识点的那张）
  const related = tables.find((table) => table.rows.some((row) => row.point_id === fixture.point_id)) ?? tables[0];
  return {
    query,
    state_hint: mode === "restricted" ? "restricted" : query === "" ? "empty" : found.length === 0 ? "insufficient_data" : "normal",
    result_count: found.length,
    groups: KINDS.flatMap((kind) => {
      const items = found.filter((row) => row.kind === kind);
      return items.length === 0 ? [] : [{ kind, count: items.length, items }];
    }),
    recent: rows.filter((row) => row.kind === "point" || row.kind === "material"),
    quick_tables: tables,
    selected_table: tables.find((table) => table.id === ctx.query.get("table"))?.id ?? related?.id ?? "",
    photo_available: mode !== "restricted",
    data_source: "sample",
  };
}

export const routes = [
  defineRoute("getSearchPage", (ctx) => searchPage(ctx), {
    variants: {
      empty: (ctx) => searchPage(ctx, "empty"),
      restricted: (ctx) => searchPage(ctx, "restricted"),
      insufficient_data: (ctx) => searchPage(ctx, "insufficient_data"),
    },
  }),
];
