// 页面清单（F06）：三端 70 页的页 ID、页名、路径、页面模式与视图，冒烟测试、黄金路径与页面画廊共用。
// 路径取各端的路由表（routes.ts，带参数的用 demo 代替）；学员端的页面模式与视图取 router/pages.ts（F05 建，router/pages.test.tsx 逐行对照 pages.md）；
// 页名取 docs/baseline/pages.md（扩展包页面去掉“（扩展包）”，和外壳显示的一致）。页面不存在时外壳的标题取各端 common.json。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROUTES as ADMIN_ROUTES, pathTo as adminPath } from "../../../apps/admin/src/routes.ts";
import { PAGES as LEARNER_PAGES, type PageMode } from "../../../apps/learner/src/router/pages.ts";
import { pathTo as learnerPath } from "../../../apps/learner/src/routes.ts";
import { ROUTES as ORG_ROUTES, pathTo as orgPath } from "../../../apps/org/src/routes.ts";
import { APP_NAMES, APP_URLS, ROOT, type AppKey } from "./env.ts";

export type { PageMode };

export interface PageView {
  /** ?view= 的取值；第一个是默认视图。 */
  readonly key: string;
  /** 这个视图的页面模式（外壳根节点的 data-mode）。 */
  readonly mode: PageMode;
}

export interface PageEntry {
  readonly app: AppKey;
  readonly id: string;
  readonly name: string;
  /** 打开这一页的路径（带参数的路由用 demo）。 */
  readonly path: string;
  /** 学员端默认视图的页面模式；机构端与平台后台的外壳不分模式，为 undefined。 */
  readonly mode: PageMode | undefined;
  /** 原型里的多视图，第一个是默认视图；没有多视图时为空。 */
  readonly views: readonly PageView[];
}

const EXTENSION_MARK = "（扩展包）";

function readRepoFile(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** pages.md 三张表的页名，按表里的顺序：页 ID → 页名。 */
function namesFromPagesMd(): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const line of readRepoFile("docs/baseline/pages.md").split(/\r?\n/)) {
    const match = /^\| ([SOP]\d{2}) \| ([^|]+?) \|/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) names.set(match[1], match[2].replace(EXTENSION_MARK, "").trim());
  }
  return names;
}

const NAMES = namesFromPagesMd();

/** pages.md 里登记的全部页 ID（学员端、机构端、平台后台，按表里的顺序）。 */
export const PAGES_MD_IDS: readonly string[] = [...NAMES.keys()];

function nameOf(id: string): string {
  const name = NAMES.get(id);
  if (name === undefined) throw new Error(`docs/baseline/pages.md 里找不到 ${id} 这一页`);
  return name;
}

const LEARNER: readonly PageEntry[] = LEARNER_PAGES.map((page) => ({
  app: "learner",
  id: page.id,
  name: nameOf(page.id),
  path: learnerPath(page.id),
  mode: page.mode,
  views: page.views.map((view) => ({ key: view.key, mode: view.mode })),
}));

function staffPages<Id extends string>(app: AppKey, routes: Readonly<Record<Id, string>>, pathTo: (id: Id) => string): PageEntry[] {
  return (Object.keys(routes) as Id[]).map((id) => ({ app, id, name: nameOf(id), path: pathTo(id), mode: undefined, views: [] }));
}

/** 三端 70 页：学员端 35、机构端 16、平台后台 19。 */
export const ALL_PAGES: readonly PageEntry[] = [
  ...LEARNER,
  ...staffPages("org", ORG_ROUTES, orgPath),
  ...staffPages("admin", ADMIN_ROUTES, adminPath),
];

export function pageById(id: string): PageEntry {
  const entry = ALL_PAGES.find((item) => item.id === id);
  if (entry === undefined) throw new Error(`页面清单里没有 ${id}`);
  return entry;
}

/** 这一页在本次测试里的完整地址；query 是 ?view=、?state=、?exam= 这类开发参数。 */
export function urlOf(entry: PageEntry, query: Readonly<Record<string, string>> = {}): string {
  const search = new URLSearchParams(query).toString();
  return `${APP_URLS[entry.app]}${entry.path}${search === "" ? "" : `?${search}`}`;
}

/** 测试标题里用的“端名 页ID 页名”。 */
export function pageLabel(entry: PageEntry): string {
  return `${APP_NAMES[entry.app]} ${entry.id} ${entry.name}`;
}

const NOT_FOUND = new Map<AppKey, string>();

/** 地址没对上任何页面时外壳显示的标题（各端 i18n/zh-CN/common.json 的 notFound.title）。 */
export function notFoundTitle(app: AppKey): string {
  const cached = NOT_FOUND.get(app);
  if (cached !== undefined) return cached;
  const common = JSON.parse(readRepoFile(`apps/${app}/src/i18n/zh-CN/common.json`)) as { notFound?: { title?: string } };
  const title = common.notFound?.title;
  if (title === undefined) throw new Error(`apps/${app}/src/i18n/zh-CN/common.json 里没有 notFound.title`);
  NOT_FOUND.set(app, title);
  return title;
}
