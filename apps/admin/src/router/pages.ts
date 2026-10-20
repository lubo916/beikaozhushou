// 平台后台 19 页的登记（F05）：分组与原型功能点数量，来源 docs/baseline/pages.md（平台后台先做简版，开工决定第 3 条）。
// 页名与分组名是文案，在 i18n/zh-CN/common.json；路径在 ../routes.ts。router/pages.test.tsx 逐行对照 pages.md。
import { ROUTES, type PageId } from "../routes.ts";
import { matchRoute } from "./history.tsx";

/** 导航分组（顺序同原型侧栏）。 */
export type NavGroup = "overview" | "exam" | "content" | "ai" | "business" | "ops" | "compliance";

export interface PageMeta {
  readonly id: PageId;
  readonly path: string;
  readonly group: NavGroup;
  /** 原型功能点数量：P0 必做、P1 增强、P2 远期（P2 先不做）。 */
  readonly features: readonly [p0: number, p1: number, p2: number];
}

const ENTRIES: readonly (readonly [PageId, NavGroup, readonly [number, number, number]])[] = [
  ["P01", "overview", [4, 7, 0]],
  ["P02", "overview", [1, 4, 0]],
  ["P03", "exam", [5, 3, 0]],
  ["P04", "exam", [8, 3, 1]],
  ["P05", "exam", [5, 2, 0]],
  ["P06", "exam", [1, 6, 0]],
  ["P07", "content", [4, 3, 0]],
  ["P08", "content", [5, 3, 0]],
  ["P09", "content", [8, 5, 0]],
  ["P10", "ai", [4, 2, 0]],
  ["P11", "ai", [5, 1, 1]],
  ["P12", "ai", [7, 3, 0]],
  ["P13", "business", [8, 9, 1]],
  ["P14", "business", [4, 3, 0]],
  ["P15", "ops", [4, 3, 1]],
  ["P16", "ops", [4, 3, 2]],
  ["P17", "ops", [7, 0, 0]],
  ["P18", "compliance", [10, 0, 0]],
  ["P19", "compliance", [13, 2, 0]],
];

export const PAGES: readonly PageMeta[] = ENTRIES.map(([id, group, features]) => ({ id, path: ROUTES[id], group, features }));

export const PAGE_BY_ID = Object.fromEntries(PAGES.map((page) => [page.id, page])) as Readonly<Record<PageId, PageMeta>>;

export const NAV_GROUPS: readonly NavGroup[] = ["overview", "exam", "content", "ai", "business", "ops", "compliance"];

/** 页名里不是规则数字的数（文案里不许写死数字，用占位符传入）；平台后台现在没有。 */
export const NAME_VALUES: Readonly<Partial<Record<PageId, Readonly<Record<string, number>>>>> = {};

export function findPage(pathname: string): PageMeta | undefined {
  return PAGES.find((page) => matchRoute(page.path, pathname) !== null);
}

export function pagesInGroup(group: NavGroup): readonly PageMeta[] {
  return PAGES.filter((page) => page.group === group);
}
