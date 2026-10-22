// S14：规则尚未接通，所有完整性与汇编结果来自示例文件；只在模拟接口筛选和分页。
import { param } from "@exam-prep/params";
import type { S14Notebook } from "@exam-prep/contract";
import { defineRoute, type MockContext } from "../route.ts";

const files = import.meta.glob<S14Notebook>("../../../../../fixtures/pages/S14/*.json", { eager: true, import: "default" });
export function notebook(ctx: MockContext, state = "normal"): S14Notebook {
  const source = files[`../../../../../fixtures/pages/S14/${ctx.exam.examId}.json`];
  if (!source) throw new Error("S14 演示数据未配置");
  const page = structuredClone(source);
  page.ai_available = state !== "restricted";
  page.paper_available = state !== "insufficient_data" && state !== "empty";
  if (state === "empty") {
    page.notes = [];
    page.favorites = [];
    page.integrity = { covered: 0, total: source.integrity.total, missing: [] };
    page.handbook = { ...page.handbook, note_count: 0, sections: [] };
    page.paper = { ...page.paper, note_count: 0, sections: [] };
  }
  const search = ctx.query.get("search")?.trim().toLocaleLowerCase() ?? "";
  const type = ctx.query.get("note_type");
  const channel = ctx.query.get("source");
  const subject = ctx.query.get("subject");
  const since = ctx.query.get("period");
  page.notes = page.notes.filter(
    (item) =>
      (!search || [item.note.title, item.note.body, item.point_path].join(" ").toLocaleLowerCase().includes(search)) &&
      (!type || item.note.note_type === type) &&
      (!channel || item.source === channel) &&
      (!subject || item.subject === subject) &&
      (!since ||
        new Intl.DateTimeFormat("en-CA", { timeZone: page.time_zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
          new Date(item.note.updated_at),
        ) >= since),
  );
  const cursor = Number(ctx.query.get("cursor") ?? 0);
  const offset = Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0;
  const requested = Number(ctx.query.get("limit") ?? param("api.page.max_limit"));
  const limit =
    Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, param("api.page.max_limit")) : param("api.page.max_limit");
  const end = offset + limit;
  page.next_cursor = end < page.notes.length ? String(end) : null;
  page.notes = page.notes.slice(offset, end);
  return page;
}
export const routes = [
  defineRoute("getS14Notebook", (ctx) => notebook(ctx), {
    variants: {
      empty: (ctx) => notebook(ctx, "empty"),
      restricted: (ctx) => notebook(ctx, "restricted"),
      insufficient_data: (ctx) => notebook(ctx, "insufficient_data"),
    },
  }),
];
