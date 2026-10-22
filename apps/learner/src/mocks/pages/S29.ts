// S29-01/02/03/04：只读示例检索。拼音、模糊与自然语言以别名演示，不冒充真实语义检索。
import type { S29Result, S29SearchPage, S29QuickTable } from "@exam-prep/contract";
import copy from "../../i18n/zh-CN/S29.json";
import { defineRoute, type MockContext } from "../route.ts";
interface PageFixture {
  sample_query: string;
  aliases: string[];
  point_id: string;
  excerpt: string;
  material_id: string;
  question_id: string;
  quick_tables: S29QuickTable[];
}
const files = import.meta.glob<PageFixture>("../../../../../fixtures/pages/S29/*.json", { eager: true, import: "default" });
type Mode = S29SearchPage["state_hint"];
export function searchPage(ctx: MockContext, mode: Mode = "normal"): S29SearchPage {
  const fixture = Object.entries(files).find(([path]) => path.endsWith(`/${ctx.exam.examId}.json`))?.[1];
  if (fixture === undefined) throw new Error(`S29 missing fixture: ${ctx.exam.examId}`);
  const query = mode === "empty" ? "" : (ctx.query.get("q") ?? fixture.sample_query).trim();
  const point = ctx.exam.map.chapters.flatMap((chapter) => chapter.sample_points).find((item) => item.id === fixture.point_id);
  const material = ctx.exam.learner.materials.find(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null && "id" in item && item.id === fixture.material_id,
  );
  const question = ctx.exam.questions.find((item) => item.id === fixture.question_id);
  const kinds = ["point", "material", "question", "note", "mistake", "tutor"] as const;
  const rows: S29Result[] = kinds.map(
    (kind): S29Result => ({
      id: kind === "question" || kind === "mistake" ? fixture.question_id : fixture.point_id,
      kind,
      title:
        kind === "material"
          ? String(material?.["title"] ?? point?.name)
          : kind === "question" || kind === "mistake"
            ? (question?.stem ?? fixture.excerpt)
            : (point?.name ?? fixture.sample_query),
      excerpt: fixture.excerpt,
      source: kind === "point" ? ctx.exam.profile.name : copy.kind[kind],
      target:
        kind === "point"
          ? "S10"
          : kind === "material"
            ? "S12"
            : kind === "question" || kind === "mistake"
              ? "S18"
              : kind === "note"
                ? "S14"
                : "S28",
      // 作答路由需要会话 ID，当前只有示例题目，使用路由表的 demo 会话，不把题目 ID 当会话。
      target_id: kind === "point" ? fixture.point_id : kind === "material" ? fixture.material_id : "demo",
      ai_generated: kind === "tutor",
    }),
  );
  const normalized = query.toLocaleLowerCase().replace(/\s/g, "");
  const matching = fixture.aliases.some(
    (alias) => normalized !== "" && (alias.toLocaleLowerCase().includes(normalized) || normalized.includes(alias.toLocaleLowerCase())),
  );
  const askedKind = ctx.query.get("kind") ?? "all";
  const found = mode !== "insufficient_data" && matching ? rows.filter((row) => askedKind === "all" || row.kind === askedKind) : [];
  const recent = rows.filter((row) => row.kind === "point" || row.kind === "material");
  return {
    query,
    state_hint: mode === "restricted" ? "restricted" : query === "" ? "empty" : found.length === 0 ? "insufficient_data" : "normal",
    result_count: found.length,
    groups: kinds.flatMap((kind) => {
      const items = found.filter((row) => row.kind === kind);
      return items.length === 0 ? [] : [{ kind, count: items.length, items }];
    }),
    recent,
    quick_tables: query !== "" && !matching ? [] : fixture.quick_tables,
    selected_table: fixture.quick_tables.find((table) => table.id === ctx.query.get("table"))?.id ?? fixture.quick_tables[0]?.id ?? "",
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
