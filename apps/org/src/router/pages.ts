// 机构端 16 页的登记（F05）：分组与原型功能点数量，来源 docs/baseline/pages.md（机构端先做简版，开工决定第 3 条）。
// 页名与分组名是文案，在 i18n/zh-CN/common.json；路径在 ../routes.ts。router/pages.test.tsx 逐行对照 pages.md。
import { ROUTES, type PageId } from "../routes.ts";
import { matchRoute } from "./history.tsx";

/** 导航分组（顺序同原型侧栏）。 */
export type NavGroup = "overview" | "enroll" | "academic" | "teaching" | "service" | "research" | "data" | "settings";

export interface PageMeta {
  readonly id: PageId;
  readonly path: string;
  readonly group: NavGroup;
  /** 原型功能点数量：P0 必做、P1 增强、P2 远期（P2 先不做）。 */
  readonly features: readonly [p0: number, p1: number, p2: number];
}

const ENTRIES: readonly (readonly [PageId, NavGroup, readonly [number, number, number]])[] = [
  ["O01", "overview", [6, 5, 0]],
  ["O02", "enroll", [1, 8, 2]],
  ["O03", "academic", [7, 4, 0]],
  ["O04", "academic", [6, 4, 0]],
  ["O05", "academic", [1, 10, 5]],
  ["O06", "teaching", [5, 4, 0]],
  ["O07", "teaching", [5, 5, 0]],
  ["O08", "service", [3, 7, 1]],
  ["O09", "service", [5, 7, 0]],
  ["O10", "service", [3, 7, 0]],
  ["O11", "research", [7, 12, 2]],
  ["O12", "service", [1, 6, 1]],
  ["O13", "data", [0, 7, 2]],
  ["O14", "settings", [1, 4, 2]],
  ["O15", "settings", [7, 7, 2]],
  ["O16", "settings", [3, 3, 1]],
];

export const PAGES: readonly PageMeta[] = ENTRIES.map(([id, group, features]) => ({ id, path: ROUTES[id], group, features }));

export const PAGE_BY_ID = Object.fromEntries(PAGES.map((page) => [page.id, page])) as Readonly<Record<PageId, PageMeta>>;

export const NAV_GROUPS: readonly NavGroup[] = ["overview", "enroll", "academic", "teaching", "service", "research", "data", "settings"];

/** 页名里不是规则数字的数（文案检查不许在文案里写死数字，用占位符传入）：O04“学员 360°”。 */
export const NAME_VALUES: Readonly<Partial<Record<PageId, Readonly<Record<string, number>>>>> = { O04: { degrees: 360 } };

export function findPage(pathname: string): PageMeta | undefined {
  return PAGES.find((page) => matchRoute(page.path, pathname) !== null);
}

export function pagesInGroup(group: NavGroup): readonly PageMeta[] {
  return PAGES.filter((page) => page.group === group);
}
