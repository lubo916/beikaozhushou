/// <reference lib="dom" />
// 冒烟测试、黄金路径与页面画廊共用的检查（F06）：打开页面、收集浏览器报错、等页面安静、核对“能打开”与七态。
// 断言只看外壳与公共状态组件（main#main、外壳根节点的 data-mode、页标题或顶栏里的页名、.ui-state--<状态代码>），
// 不看各页的具体内容：页面任务把空壳换成正式页面后照样适用。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { notFoundTitle, pageLabel, type PageEntry, type PageView } from "./catalog.ts";
import { ROOT } from "./env.ts";

/** 七态里除正常以外的六种（vocabulary.md 第 7 节；锁定只有个别页面有，不在七态里）。 */
export const ABNORMAL_STATES = ["loading", "empty", "error", "offline", "restricted", "insufficient_data"] as const;
export type AbnormalState = (typeof ABNORMAL_STATES)[number];
export type StateCode = "normal" | AbnormalState;

export const STATE_NAMES: Readonly<Record<StateCode, string>> = {
  normal: "正常",
  loading: "加载",
  empty: "空",
  error: "出错",
  offline: "离线",
  restricted: "受限",
  insufficient_data: "数据不足",
};

interface UiCopy {
  readonly state: { readonly error: { readonly title: string } };
  readonly action: { readonly retry: string };
}

/** 公共状态组件的文案（packages/ui/src/copy.zh-CN.json）：出错标题“{{page}}没能加载”与“重试”按钮。 */
const COPY = JSON.parse(readFileSync(join(ROOT, "packages/ui/src/copy.zh-CN.json"), "utf8")) as UiCopy;

/** 假数据层在出错、离线、受限三态下故意让接口失败（500、断网、403），浏览器会为每个失败的接口请求记一条“资源加载失败”：预期内，不算报错。 */
const API_FAILURE_STATES: ReadonlySet<StateCode> = new Set<StateCode>(["error", "offline", "restricted"]);
const RESOURCE_FAILURE = /^Failed to load resource\b/;

/** “页面安静”：这么久没有新加载完成的资源。 */
const QUIET_MS = 500;
const SETTLE_TIMEOUT_MS = 20_000;

interface BrowserProblem {
  readonly kind: "pageerror" | "console";
  readonly text: string;
  readonly url: string;
}

function isApiRequest(url: string): boolean {
  try {
    return new URL(url).pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

/** 该状态下预期内的报错：出错、离线、受限三态里，接口请求失败时浏览器记的“资源加载失败”。 */
function isExpected(problem: BrowserProblem, state: StateCode): boolean {
  if (problem.kind !== "console" || !API_FAILURE_STATES.has(state)) return false;
  return RESOURCE_FAILURE.test(problem.text) && isApiRequest(problem.url);
}

function describeProblem(problem: BrowserProblem): string {
  const where = problem.url === "" ? "" : `（${problem.url}）`;
  return `${problem.kind === "pageerror" ? "未捕获的异常" : "控制台报错"}：${problem.text}${where}`;
}

/** 页面里记下最近一次资源加载完成的时刻（作为 init script，每次打开页面都先于页面脚本运行；函数会被序列化，不能引用外面的变量）。 */
function markResourceActivity(): void {
  const target = window as unknown as { __bkActivity?: number };
  const mark = (): void => {
    target.__bkActivity = performance.now();
  };
  mark();
  new PerformanceObserver(mark).observe({ type: "resource", buffered: true });
}

export async function installActivityMarker(page: Page): Promise<void> {
  await page.addInitScript(markResourceActivity);
}

/** 等页面安静下来：最近 0.5 秒没有新加载完成的资源（懒加载的页面模块与假数据接口都已返回；故意挂起的请求不算）。需先 installActivityMarker。 */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    (quiet) => performance.now() - ((window as unknown as { __bkActivity?: number }).__bkActivity ?? 0) >= quiet,
    QUIET_MS,
    { polling: 100, timeout: SETTLE_TIMEOUT_MS },
  );
}

export interface PageWatch {
  /** 先回空白页（上一页的请求与计时器随之停止）、清空记录，再打开地址；地址要返回成功。 */
  open(url: string): Promise<void>;
  /** 这次打开以来的浏览器报错（未捕获的异常、控制台 error），去掉该状态下预期内的接口失败。 */
  problems(state: StateCode): string[];
}

/** 开始盯住一个标签页的报错；同时装上 settle 用的资源记录。 */
export async function watchPage(page: Page): Promise<PageWatch> {
  const seen: BrowserProblem[] = [];
  page.on("pageerror", (error) => seen.push({ kind: "pageerror", text: error.message, url: "" }));
  page.on("console", (message) => {
    if (message.type() === "error") seen.push({ kind: "console", text: message.text(), url: message.location().url });
  });
  await installActivityMarker(page);
  return {
    async open(url) {
      await page.goto("about:blank");
      seen.length = 0;
      const response = await page.goto(url);
      expect(response?.ok(), `打开 ${url} 应返回成功`).toBe(true);
    },
    problems(state) {
      return seen.filter((item) => !isExpected(item, state)).map(describeProblem);
    },
  };
}

/** “能打开”：外壳正文区在；页名出现在页标题（h1）或顶栏、沉浸栏里；不是“没有这个页面”；学员端的页面模式与登记一致。 */
export async function expectOpened(page: Page, entry: PageEntry, view: PageView | undefined): Promise<void> {
  const label = `${pageLabel(entry)}${view === undefined ? "" : `（视图 ${view.key}）`}`;
  await expect(page.locator("main#main"), `${label}：外壳的正文区应显示`).toBeVisible();
  const title = page.getByRole("heading", { level: 1, name: entry.name, exact: true });
  const bar = page.locator("header").getByText(entry.name, { exact: true });
  await expect(title.or(bar).filter({ visible: true }).first(), `${label}：页名应出现在页标题或顶栏`).toBeVisible();
  const notFound = notFoundTitle(entry.app);
  await expect(page.getByRole("heading", { name: notFound, exact: true }), `${label}：不应显示“${notFound}”`).toHaveCount(0);
  const mode = view?.mode ?? entry.mode;
  if (mode !== undefined) {
    await expect(page.locator("[data-mode]").first(), `${label}：页面模式应为 ${mode}`).toHaveAttribute("data-mode", mode);
  }
}

/** 正常态加载完以后不应还停在整页的加载态。 */
export async function expectLoaded(page: Page, entry: PageEntry): Promise<void> {
  await settle(page);
  await expect(page.locator("main#main .ui-state--loading"), `${pageLabel(entry)}：加载完后不应还在加载`).toHaveCount(0);
}

/** 用 ?state= 强制的状态：正文区里显示公共状态组件 .ui-state--<代码>；出错态的标题与“重试”按钮按 ui-rules 第 4 节。 */
export async function expectState(page: Page, entry: PageEntry, state: AbnormalState): Promise<void> {
  const label = `${pageLabel(entry)} ${STATE_NAMES[state]}态`;
  const shown = page.locator(`main#main .ui-state--${state}`).first();
  await expect(shown, `${label}：应显示公共状态组件 .ui-state--${state}`).toBeVisible();
  if (state === "loading") {
    // 外壳等懒加载的页面模块时也显示加载态：页面安静下来以后还在加载，才说明是 ?state= 强制出来的
    await settle(page);
    await expect(shown, `${label}：页面加载完后应仍显示加载态`).toBeVisible();
  }
  if (state === "error") {
    await expect(shown, `${label}：出错提示要让读屏软件马上念出来`).toHaveAttribute("role", "alert");
    await expect(shown, `${label}：标题应为“<页名>没能加载”`).toContainText(COPY.state.error.title.replace("{{page}}", entry.name));
    await expect(shown.getByRole("button", { name: COPY.action.retry, exact: true }), `${label}：应有“重试”按钮`).toBeVisible();
  }
}
