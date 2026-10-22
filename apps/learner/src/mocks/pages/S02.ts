// S02 的页面模拟层：考试差异只在四个 fixture；搜索与筛选在接口层执行。
// 所有初判、目标分、重叠率均为 fixture 示例，未运行真实预测或时间分配规则。
import type { S02ExamChoice, S02Goal, S02GoalsHome, S02PassedSubject } from "@exam-prep/contract";
import { ApiError } from "@exam-prep/contract/errors";
import { defineRoute, type MockContext } from "../route.ts";

interface PageFixture {
  readonly choice: S02ExamChoice;
  readonly goal: S02Goal;
  readonly categories: string[];
  readonly extensions: string[];
  readonly passed_subjects: S02PassedSubject[];
  readonly certificate_path: string[];
  readonly conflict: string;
  readonly guest_limit: number;
}

const FILES = import.meta.glob("../../../../../fixtures/pages/S02/*.json", { eager: true, import: "default" });
const PAGES = Object.values(FILES) as PageFixture[];

function fixture(examId: string): PageFixture {
  const page = PAGES.find((entry) => entry.choice.id === examId);
  if (page === undefined) throw new Error("S02 演示考试缺少页面数据");
  return page;
}

function searchValue(ctx: MockContext, header: string, query: string): string {
  const value = ctx.headers.get(header);
  if (value === null) return ctx.query.get(query) ?? "";
  try {
    return decodeURIComponent(value);
  } catch {
    throw new ApiError("COMMON_VALIDATION", { header });
  }
}

function matches(choice: S02ExamChoice, ctx: MockContext): boolean {
  const query = searchValue(ctx, "x-s02-search", "q").trim().toLocaleLowerCase();
  const category = searchValue(ctx, "x-s02-category", "category");
  const text = [choice.name, choice.short_name, choice.search_terms, ...choice.aliases].join(" ").toLocaleLowerCase();
  // 一句话目标也按词组匹配候选；解析为正式目标仍需用户逐项确认。
  const tokens = query.split(/[，。！？、\s]+/u).filter(Boolean);
  const queryMatches =
    query === "" ||
    text.includes(query) ||
    tokens.some((token) => text.includes(token)) ||
    [choice.name, choice.short_name, ...choice.aliases].some((alias) => query.includes(alias.toLocaleLowerCase()));
  return queryMatches && (category === "" || choice.category === category);
}

function home(ctx: MockContext, availability: S02GoalsHome["availability"]): S02GoalsHome {
  const page = fixture(ctx.exam.examId);
  const choices = [page, ...PAGES.filter((entry) => entry.choice.id !== page.choice.id)].map((entry) => entry.choice);
  const catalog = availability === "insufficient_data" ? [] : choices.filter((choice) => matches(choice, ctx));
  const templates = choices
    .filter((choice) => choice.profile.kind === "template" || choice.profile.kind === "custom")
    .filter((choice) => matches(choice, ctx));
  const other = PAGES.find((entry) => entry.choice.id !== page.choice.id)?.goal;
  const goals = availability === "empty" ? [] : [page.goal, ...(other === undefined ? [] : [{ ...other, primary: false }])];
  return {
    catalog,
    custom_choice: fixture("ds-final-custom").choice,
    templates: availability === "insufficient_data" ? [] : templates,
    goals,
    categories: page.categories,
    extensions: page.extensions,
    passed_subjects: page.passed_subjects,
    certificate_path: page.certificate_path,
    conflict: page.conflict,
    availability,
    guest_limit: page.guest_limit,
    data_source: "sample",
  };
}

export const routes = [
  defineRoute("getS02Goals", (ctx) => home(ctx, "normal"), {
    variants: {
      empty: (ctx) => home(ctx, "empty"),
      restricted: (ctx) => home(ctx, "restricted"),
      insufficient_data: (ctx) => home(ctx, "insufficient_data"),
    },
  }),
];
