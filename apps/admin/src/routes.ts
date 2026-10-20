// 平台后台路由表（F05）：页面 ID → 路径，以 docs/baseline/pages.md 为准；改路由要同时改这里与 pages.md。
// 跳转一律用这里的常量或 pathTo()，不手写路径字符串（ui-rules 第 8 节）。
export const ROUTES = {
  P01: "/cockpit",
  P02: "/data-hub",
  P03: "/exam-profiles",
  P04: "/maps",
  P05: "/exam-analysis",
  P06: "/impact",
  P07: "/pipeline",
  P08: "/question-review",
  P09: "/templates",
  P10: "/ai-scenarios",
  P11: "/ai-actors",
  P12: "/ai-evals",
  P13: "/users",
  P14: "/tenants",
  P15: "/outreach",
  P16: "/support",
  P17: "/safety",
  P18: "/compliance",
  P19: "/system",
} as const;

export type PageId = keyof typeof ROUTES;

/** 首页：根路径跳到这里。 */
export const HOME_ID: PageId = "P01";

/** 带 :参数 的路由，开发时用 demo 代替（pages.md 开头的约定；平台后台现在没有带参数的路由）。 */
export const DEMO_PARAM = "demo";

/** 填好参数的路径；没给的参数用 demo。 */
export function pathTo(id: PageId, params: Readonly<Record<string, string>> = {}): string {
  return ROUTES[id].replace(/:(\w+)/g, (_whole: string, name: string) => encodeURIComponent(params[name] ?? DEMO_PARAM));
}
