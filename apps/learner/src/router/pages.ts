// 学员端 35 页的登记（F05）：分组、页面模式、视图（?view= 的键与各自的模式）与原型功能点数量，来源 docs/baseline/pages.md。
// 页名、视图名与分组名是文案，在 i18n/zh-CN/common.json；路径在 ../routes.ts。router/pages.test.tsx 逐行对照 pages.md。
import { matchPath } from "react-router";
import { ROUTES, type LearnerPageId } from "../routes.ts";

/** 页面模式（vocabulary.md 第 7 节）。 */
export type PageMode = "standard" | "guided" | "immersive" | "standalone";

/** 导航分组：入门（走完即隐藏）、今日、学、记、练、考、助、我。 */
export type NavGroup = "onboarding" | "today" | "learn" | "memorize" | "practice" | "exam" | "assist" | "me";

export interface PageView {
  /** ?view= 的取值。 */
  readonly key: string;
  readonly mode: PageMode;
  /** 这个视图里不显示“问导师”浮标（摸底测评中关闭导师与提示、模考作答中暂停）。 */
  readonly noTutor?: true;
}

export interface PageMeta {
  readonly id: LearnerPageId;
  readonly path: string;
  readonly group: NavGroup;
  /** 页面的默认模式；有多视图时就是第一个视图的模式。 */
  readonly mode: PageMode;
  /** 原型里的多视图，第一个是默认视图；没有多视图时为空。 */
  readonly views: readonly PageView[];
  /** 原型功能点数量：P0 必做、P1 增强、P2 远期（P2 先不做）。 */
  readonly features: readonly [p0: number, p1: number, p2: number];
  /** 扩展包页面：只在当前考试启用了对应扩展时出现在导航里。 */
  readonly extension: boolean;
}

const view = (key: string, mode: PageMode, extra: { readonly noTutor?: true } = {}): PageView => ({ key, mode, ...extra });

type Entry = readonly [
  id: LearnerPageId,
  group: NavGroup,
  mode: PageMode,
  features: readonly [number, number, number],
  views?: readonly PageView[],
  extension?: boolean,
];

const ENTRIES: readonly Entry[] = [
  ["S01", "onboarding", "standalone", [13, 8, 1], [view("first", "standalone"), view("back", "standalone"), view("abn", "standalone")]],
  ["S02", "onboarding", "guided", [11, 7, 2], [view("first", "guided"), view("manage", "standard")]],
  ["S03", "onboarding", "guided", [9, 3, 0], [view("time", "guided"), view("res", "guided")]],
  ["S04", "onboarding", "guided", [11, 3, 0], [view("start", "guided"), view("test", "immersive", { noTutor: true })]],
  ["S05", "onboarding", "guided", [10, 3, 1], [view("normal", "guided"), view("quick", "guided")]],
  ["S06", "today", "standard", [19, 6, 0], ["normal", "first", "done", "off", "back", "noai"].map((key) => view(key, "standard"))],
  ["S07", "today", "standard", [10, 9, 0]],
  ["S08", "today", "standard", [6, 8, 1]],
  ["S09", "learn", "standard", [10, 9, 1]],
  ["S10", "learn", "standard", [12, 5, 0]],
  ["S11", "learn", "standard", [12, 11, 0]],
  ["S12", "learn", "immersive", [10, 11, 2]],
  ["S13", "learn", "immersive", [7, 7, 1], [view("video", "immersive"), view("audio", "standard"), view("ext", "standard")]],
  ["S14", "learn", "standard", [7, 7, 0]],
  ["S15", "memorize", "standard", [9, 9, 2], [view("home", "standard"), view("session", "immersive")]],
  ["S16", "memorize", "standard", [8, 6, 0]],
  ["S17", "practice", "standard", [9, 15, 1]],
  ["S18", "practice", "immersive", [16, 10, 2], [view("obj", "immersive"), view("gen", "immersive")]],
  ["S19", "practice", "standard", [7, 12, 1]],
  ["S20", "practice", "standard", [7, 9, 1]],
  ["S21", "practice", "standard", [2, 8, 2], [], true],
  // 开考确认按 pages.md 与 ui-rules 第 3 节算标准页（只有作答中是沉浸页）；V3 登记 design/screens 把它记成沉浸页，以基线为准
  [
    "S22",
    "exam",
    "standard",
    [7, 5, 2],
    [view("home", "standard"), view("confirm", "standard"), view("exam", "immersive", { noTutor: true })],
  ],
  ["S23", "exam", "standard", [8, 4, 1]],
  ["S24", "exam", "standard", [9, 10, 3]],
  ["S25", "exam", "standard", [5, 6, 1]],
  ["S26", "exam", "standard", [2, 6, 1], [], true],
  ["S27", "exam", "standard", [5, 7, 1], [view("sprint", "standard"), view("after", "standard")]],
  ["S28", "assist", "standard", [12, 8, 2], [view("normal", "standard"), view("crisis", "standard"), view("down", "standard")]],
  ["S29", "assist", "standard", [2, 4, 3]],
  ["S30", "assist", "standard", [1, 5, 6]],
  ["S31", "me", "standard", [13, 7, 5]],
  ["S32", "me", "standard", [17, 8, 5]],
  ["S33", "me", "standard", [6, 9, 3]],
  ["S34", "me", "standard", [0, 6, 1]],
  ["S35", "me", "standard", [4, 7, 1]],
];

export const PAGES: readonly PageMeta[] = ENTRIES.map(([id, group, mode, features, views = [], extension = false]) => ({
  id,
  path: ROUTES[id],
  group,
  mode,
  views,
  features,
  extension,
}));

export const PAGE_BY_ID = Object.fromEntries(PAGES.map((page) => [page.id, page])) as Readonly<Record<LearnerPageId, PageMeta>>;

/** 侧栏、图标栏与抽屉里分组的顺序。 */
export const NAV_GROUPS: readonly NavGroup[] = ["onboarding", "today", "learn", "memorize", "practice", "exam", "assist", "me"];

export type TabKey = "today" | "learn" | "practice" | "tutor" | "me";

export interface Tab {
  readonly key: TabKey;
  readonly page: LearnerPageId;
  /** 这些分组里的页面打开时，这个标签算“当前”。 */
  readonly groups: readonly NavGroup[];
}

/** 手机底部五个标签（pages.md「学员端导航」）：今日、学习、练测、导师、我的。 */
export const TABS: readonly Tab[] = [
  { key: "today", page: "S06", groups: ["today"] },
  { key: "learn", page: "S09", groups: ["learn", "memorize"] },
  { key: "practice", page: "S17", groups: ["practice", "exam"] },
  { key: "tutor", page: "S28", groups: ["assist"] },
  { key: "me", page: "S34", groups: ["me"] },
];

/** 入门步骤条的五步（ui-rules 第 3 节）：欢迎、备考目标、时间与资料、摸底、起点报告。 */
export const ONBOARDING_STEPS: readonly LearnerPageId[] = ["S01", "S02", "S03", "S04", "S05"];

/** 按地址找页面（带参数的路由也认）；找不到返回 undefined。 */
export function findPage(pathname: string): PageMeta | undefined {
  return PAGES.find((page) => matchPath({ path: page.path, end: true }, pathname) !== null);
}

export function pagesInGroup(group: NavGroup): readonly PageMeta[] {
  return PAGES.filter((page) => page.group === group);
}

/** 当前视图：开发时 ?view= 指定的优先，其次是页面按数据选的，都没有就用第一个视图。 */
export function resolveView(page: PageMeta, forced: string | null, chosen: string | null): PageView | undefined {
  return page.views.find((item) => item.key === forced) ?? page.views.find((item) => item.key === chosen) ?? page.views[0];
}
