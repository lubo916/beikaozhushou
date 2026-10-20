// 学员端路由表（F05）：页面 ID → 路径，以 docs/baseline/pages.md 为准；改路由要同时改这里与 pages.md。
// 跳转一律用这里的常量或 pathTo()，不手写路径字符串（ui-rules 第 8 节）。
export const ROUTES = {
  S01: "/welcome",
  S02: "/goals",
  S03: "/setup",
  S04: "/diagnosis",
  S05: "/start-report",
  S06: "/today",
  S07: "/plan",
  S08: "/recap",
  S09: "/map",
  S10: "/kp/:kpId",
  S11: "/materials",
  S12: "/reader/:docId",
  S13: "/classroom",
  S14: "/notes",
  S15: "/review",
  S16: "/recite",
  S17: "/practice",
  S18: "/quiz/:sessionId",
  S19: "/mistakes",
  S20: "/grading",
  S21: "/oral",
  S22: "/mock",
  S23: "/mock/report/:reportId",
  S24: "/progress",
  S25: "/calendar",
  S26: "/enroll",
  S27: "/sprint",
  S28: "/tutor",
  S29: "/search",
  S30: "/study-room",
  S31: "/membership",
  S32: "/privacy",
  S33: "/settings",
  S34: "/growth",
  S35: "/messages",
} as const;

export type LearnerPageId = keyof typeof ROUTES;

/** 首页：根路径跳到这里。 */
export const HOME_ID: LearnerPageId = "S06";

/** AI 导师页：外壳的“问导师”面板里有入口；这一页本身不再显示浮标。 */
export const TUTOR_ID: LearnerPageId = "S28";

/** 带 :参数 的路由，开发时用 demo 代替（pages.md 开头的约定）。 */
export const DEMO_PARAM = "demo";

/** 填好参数的路径：pathTo("S10", { kpId: "k1" }) → "/kp/k1"；没给的参数用 demo。 */
export function pathTo(id: LearnerPageId, params: Readonly<Record<string, string>> = {}): string {
  return ROUTES[id].replace(/:(\w+)/g, (_whole: string, name: string) => encodeURIComponent(params[name] ?? DEMO_PARAM));
}
