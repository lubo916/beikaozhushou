// 机构端路由表（F05）：页面 ID → 路径，以 docs/baseline/pages.md 为准；改路由要同时改这里与 pages.md。
// 跳转一律用这里的常量或 pathTo()，不手写路径字符串（ui-rules 第 8 节）。
export const ROUTES = {
  O01: "/workbench",
  O02: "/leads",
  O03: "/classes",
  O04: "/students/:studentId",
  O05: "/schedule",
  O06: "/teaching",
  O07: "/class-exams",
  O08: "/alerts",
  O09: "/grading",
  O10: "/qa",
  O11: "/content",
  O12: "/completion",
  O13: "/data",
  O14: "/brand",
  O15: "/org-settings",
  O16: "/subscription",
} as const;

export type PageId = keyof typeof ROUTES;

/** 首页：根路径跳到这里。 */
export const HOME_ID: PageId = "O01";

/** 带 :参数 的路由，开发时用 demo 代替（pages.md 开头的约定）。 */
export const DEMO_PARAM = "demo";

/** 填好参数的路径：pathTo("O04", { studentId: "s1" }) → "/students/s1"；没给的参数用 demo。 */
export function pathTo(id: PageId, params: Readonly<Record<string, string>> = {}): string {
  return ROUTES[id].replace(/:(\w+)/g, (_whole: string, name: string) => encodeURIComponent(params[name] ?? DEMO_PARAM));
}
