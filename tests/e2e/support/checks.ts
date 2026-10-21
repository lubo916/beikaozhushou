/// <reference lib="dom" />
// 冒烟测试、黄金路径与页面画廊共用的检查（F06）：打开页面并等它就绪、收集浏览器报错、等页面安静、核对“能打开”、正常态的正文与七态。
// 断言只看外壳与公共状态组件（main#main、外壳根节点的 data-mode、页标题或顶栏里的页名、.ui-state--<状态代码>），
// 不看各页的具体内容：页面任务把空壳换成正式页面后照样适用。这些检查自己的回归测试在 tests/e2e/smoke/checks.spec.ts。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Frame, type Page, type Response } from "@playwright/test";
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

/** 接口失败的结果：HTTP 状态码，或断网（请求没拿到回应）。 */
type ApiOutcome = number | "network";

/**
 * 假数据层在出错、离线、受限三态下故意让接口失败（apps/learner/src/mocks/api.ts；状态码见 contracts/errors.yaml）：
 * 出错态一律回 500（COMMON_INTERNAL），受限态回 403（COMMON_FORBIDDEN；该接口有受限态数据时照常返回），离线态让请求断网（Service Worker 回错误响应）。
 * 查询失败后还会自动重试几次，每次都再记一条。只在这三态、只对该态的这一种失败放行。
 */
const EXPECTED_API_FAILURE: Readonly<Partial<Record<StateCode, ApiOutcome>>> = { error: 500, restricted: 403, offline: "network" };
/** Chromium、WebKit 记“接口回了错误状态”的固定写法，出处就是失败的那个地址（Chromium 实测）：Failed to load resource: the server responded with a status of 500 (Internal Server Error)。 */
const HTTP_FAILURE = /^Failed to load resource: the server responded with a status of (\d{3})(?: \([^)]*\))?$/;
/** Chromium、WebKit 记“请求断网”的固定写法（Service Worker 回错误响应也是它），出处同上（Chromium 实测为 net::ERR_FAILED，WebKit 冒号后写原因）。 */
const NETWORK_FAILURE = /^Failed to load resource: (?!the server responded with a status of )\S/;
/** Firefox 记“Service Worker 回了错误响应”的固定写法（Gecko 的 dom.properties），地址在正文的固定位置，出处是 Service Worker 脚本。 */
const FIREFOX_INTERCEPTION_FAILURE =
  /^Failed to load ‘([^’]+)’\. A ServiceWorker (?:passed an error Response to FetchEvent\.respondWith\(\)|intercepted the request and encountered an unexpected error)/i;

/** “页面安静”：这么久没有新加载完成的资源。 */
const QUIET_MS = 500;
const SETTLE_TIMEOUT_MS = 20_000;
/**
 * 等外壳出现的上限。学员端要等假数据层（MSW）接上才显示页面，这一步最多等 5 秒（apps/learner/src/mocks/index.ts 的 START_TIMEOUT_MS）；
 * MSW 的 Service Worker 在上一页关掉时会自己注销，下一页若赶上它还没注销完，MSW 会把页面再刷新一次重新接上：按两轮启动、再加载页面模块的时间算。
 */
const READY_TIMEOUT_MS = 20_000;
/** 正常态的正文检查重试多久（与 expect 默认的 5 秒一致）：页面安静以后正文还在换，就等它换完。 */
const BODY_TIMEOUT_MS = 5_000;
/** 304 Not Modified：浏览器带着缓存来问，服务器说缓存仍然有效，页面用缓存里的那一份（WebKit 再次打开同一地址时就报这个）。 */
const NOT_MODIFIED = 304;
const HTTP_ERROR = 400;

interface BrowserProblem {
  readonly kind: "pageerror" | "console";
  readonly text: string;
  readonly url: string;
}

interface ApiFailure {
  readonly url: string;
  readonly outcome: ApiOutcome;
}

/** 这次打开以来 Playwright 看到的接口请求，以及其中失败的（回 4xx、5xx，或断网）。 */
interface ApiTraffic {
  readonly requested: Set<string>;
  readonly failed: ApiFailure[];
}

/** 报错的第一行（Playwright 断言失败时第一行就是我们写的说明），用来汇总。 */
export function firstLine(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.split("\n")[0] ?? text;
}

/** 接口请求（路径在 /api/ 下）的规范地址；不是接口请求或地址读不懂时为 null。 */
function apiUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/api/") ? parsed.href : null;
  } catch {
    return null;
  }
}

function outcomeName(outcome: ApiOutcome): string {
  return outcome === "network" ? "断网" : `回 ${outcome}`;
}

/**
 * 认出浏览器自己记的一条资源加载失败：哪个地址、什么结果；认不出来为 null。应用自己 console.error 的认不出来——
 * Chromium、WebKit 的写法要求出处就是失败的那个地址（应用打的日志出处是脚本），Firefox 的写法要求正文是 Gecko 的固定句子。
 */
function reportedFailure(problem: BrowserProblem): ApiFailure | null {
  if (problem.kind !== "console") return null;
  const firefox = FIREFOX_INTERCEPTION_FAILURE.exec(problem.text)?.[1];
  if (firefox !== undefined) return { url: firefox, outcome: "network" };
  if (problem.url === "") return null;
  const status = HTTP_FAILURE.exec(problem.text)?.[1];
  if (status !== undefined) return { url: problem.url, outcome: Number(status) };
  return NETWORK_FAILURE.test(problem.text) ? { url: problem.url, outcome: "network" } : null;
}

/**
 * 一条报错在该状态下是不是预期内的接口失败。三样都对上才放过：是浏览器自己记的资源加载失败、失败的是接口请求；
 * 失败的结果正是这一态假数据层该给的（出错 500、受限 403、离线断网）；Playwright 也看到这个请求真的这样失败了
 * （浏览器没把这个请求报给 Playwright 时，只能凭前两样）。未捕获的异常、应用自己 console.error 的报错（哪怕正文里有接口地址）从不放过。
 * 返回 null 表示放过；否则返回写进失败说明的补充（没有补充时为空串）。
 */
function unexpectedNote(problem: BrowserProblem, state: StateCode, traffic: ApiTraffic): string | null {
  const want = EXPECTED_API_FAILURE[state];
  const reported = reportedFailure(problem);
  if (want === undefined || reported === null) return "";
  const url = apiUrl(reported.url);
  if (url === null) return "（浏览器记的资源加载失败，但失败的不是接口请求）";
  if (reported.outcome !== want) {
    return `（浏览器记的是接口${outcomeName(reported.outcome)}，${STATE_NAMES[state]}态假数据层给的是${outcomeName(want)}）`;
  }
  const seen = !traffic.requested.has(url) || traffic.failed.some((failure) => failure.url === url && failure.outcome === want);
  return seen ? null : "（浏览器记了接口失败，但没观察到这个请求这样失败）";
}

function describeProblem(problem: BrowserProblem): string {
  const where = problem.url === "" ? "" : `（${problem.url}）`;
  return `${problem.kind === "pageerror" ? "未捕获的异常" : "控制台报错"}：${problem.text.replace(/\s*\n\s*/g, " ")}${where}`;
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

/** page.goto 的回应里判断打开成功要用的部分（自测里可以直接造一个）。 */
export type NavigationResponse = Pick<Response, "ok" | "status" | "statusText">;

/**
 * 打开地址得到的回应算不算打开成功：2xx 是正常返回；304 是浏览器带着缓存来问、服务器说缓存仍然有效，页面用缓存里的那一份
 * （WebKit 再次打开同一地址时就报 304，页面照常显示）。没有回应（page.goto 返回 null）、4xx、5xx 都不算；断网之类 page.goto 直接报错。
 * 返回失败说明，成功为 null。页面打开后能不能用，由 waitForAppReady、expectOpened、expectLoaded 接着核对。
 */
export function navigationProblem(response: NavigationResponse | null, url: string): string | null {
  if (response === null) return `打开 ${url} 没有拿到回应`;
  const status = response.status();
  if (response.ok() || status === NOT_MODIFIED) return null;
  const text = response.statusText();
  return `打开 ${url} 应返回成功（2xx，或缓存仍然有效的 304），实际是 ${status}${text === "" ? "" : ` ${text}`}`;
}

/** 页面这时的加载进度、是否受 Service Worker 控制（函数会被序列化到页面里运行）。 */
function readinessOf(): { readonly readyState: string; readonly controlled: boolean } {
  return { readyState: document.readyState, controlled: "serviceWorker" in navigator && navigator.serviceWorker.controller !== null };
}

/**
 * 等刚打开的地址真正就绪：最终页面（中途自己刷新或跳转的，以最后一次为准）的外壳正文区 main#main 出现、页面加载完。
 * 有上限：到时还没就绪就报错，写明当前地址、等待期间主框架导航了几次、加载进度、是否受 Service Worker 控制，方便对照 trace 找原因。
 */
export async function waitForAppReady(page: Page, timeout = READY_TIMEOUT_MS): Promise<void> {
  const navigations: string[] = [];
  const onNavigated = (frame: Frame): void => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  };
  page.on("framenavigated", onNavigated);
  try {
    await page.locator("main#main").waitFor({ state: "visible", timeout });
    await page.waitForLoadState("load", { timeout });
  } catch (error) {
    const status = await page.evaluate(readinessOf).catch(() => null);
    const path = navigations.length === 0 ? "" : `（${navigations.join(" → ")}）`;
    const controlled = status?.controlled === true ? "是" : "否";
    const detail = status === null ? "页面状态读不到" : `加载进度 ${status.readyState}；受 Service Worker 控制：${controlled}`;
    const reason = `外壳的正文区 main#main 在 ${timeout / 1000} 秒内没出现：地址 ${page.url()}；等待期间主框架导航 ${navigations.length} 次${path}；${detail}`;
    throw new Error(`${reason}；${firstLine(error)}`, { cause: error });
  } finally {
    page.off("framenavigated", onNavigated);
  }
}

export interface PageWatch {
  /** 先回空白页（上一页的请求与计时器随之停止）、清空记录，再打开地址：回应要成功（2xx，或缓存仍然有效的 304），再等页面就绪（waitForAppReady）。 */
  open(url: string): Promise<void>;
  /** 这次打开以来的浏览器报错（未捕获的异常、控制台 error），去掉该状态下预期内的接口失败（见 unexpectedNote）。 */
  problems(state: StateCode): string[];
}

/** 开始盯住一个标签页：浏览器报错、接口请求及其失败；同时装上 settle 用的资源记录。 */
export async function watchPage(page: Page): Promise<PageWatch> {
  const seen: BrowserProblem[] = [];
  const traffic: ApiTraffic = { requested: new Set<string>(), failed: [] };
  page.on("pageerror", (error) => seen.push({ kind: "pageerror", text: error.message, url: "" }));
  page.on("console", (message) => {
    if (message.type() === "error") seen.push({ kind: "console", text: message.text(), url: message.location().url });
  });
  page.on("request", (request) => {
    const url = apiUrl(request.url());
    if (url !== null) traffic.requested.add(url);
  });
  page.on("response", (response) => {
    const url = apiUrl(response.url());
    if (url !== null && response.status() >= HTTP_ERROR) traffic.failed.push({ url, outcome: response.status() });
  });
  page.on("requestfailed", (request) => {
    const url = apiUrl(request.url());
    if (url !== null) traffic.failed.push({ url, outcome: "network" });
  });
  await installActivityMarker(page);
  return {
    async open(url) {
      await page.goto("about:blank");
      seen.length = 0;
      traffic.requested.clear();
      traffic.failed.length = 0;
      const response = await page.goto(url);
      expect(navigationProblem(response, url), `打开 ${url} 应返回成功`).toBeNull();
      await waitForAppReady(page);
    },
    problems(state) {
      return seen.flatMap((item) => {
        const note = unexpectedNote(item, state, traffic);
        return note === null ? [] : [`${describeProblem(item)}${note}`];
      });
    },
  };
}

/** 没有浏览器报错；有的话把报错本身写进失败说明（一页的冒烟测试最后只汇总每一步失败说明的第一行）。 */
export function expectNoProblems(watch: PageWatch, state: StateCode, where = ""): void {
  const problems = watch.problems(state);
  const detail = problems.length === 0 ? "" : `：${problems.join("；")}`;
  expect(problems, `${where}不应有浏览器报错${detail}`).toEqual([]);
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

/** 正文区的情况。 */
interface MainBody {
  /** 整页的状态占位：不是紧凑版、也不在卡片（.ui-card）里的公共状态组件，写成“状态代码「文字」”。 */
  readonly placeholders: string[];
  /** 状态占位以外有没有看得见的正文（文字、图片、图表、表单控件）。 */
  readonly content: boolean;
}

/**
 * 在页面里查正文区 main#main（函数会被序列化到页面里运行，不能引用外面的变量）。
 * 卡片里的局部提示（紧凑版 .ui-state--compact，或放在 .ui-card 里的空态、数据不足、加载）不算整页占位。
 */
function inspectMain(): MainBody {
  const main = document.querySelector("main#main");
  if (main === null) return { placeholders: [], content: false };
  const shown = (element: Element): boolean => {
    const box = element.getBoundingClientRect();
    return box.width > 1 && box.height > 1 && element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  };
  const placeholders = [...main.querySelectorAll(".ui-state")]
    .filter((element) => !element.classList.contains("ui-state--compact") && element.closest(".ui-card") === null && shown(element))
    .map((element) => {
      const code = [...element.classList].find((name) => name.startsWith("ui-state--"))?.slice("ui-state--".length) ?? "";
      return `${code}「${(element.textContent ?? "").replace(/\s+/g, " ").trim()}」`;
    });
  const media = new Set(["img", "svg", "canvas", "video", "picture", "iframe", "input", "textarea", "select", "button"]);
  const hasText = (element: Element): boolean =>
    [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "");
  const isContent = (element: Element): boolean =>
    element.closest(".ui-state") === null && shown(element) && (media.has(element.localName) || hasText(element));
  return { placeholders, content: [...main.querySelectorAll("*")].some(isContent) };
}

/** 正常态的正文：不应整页显示状态占位（出错、离线、受限、空、数据不足等；卡片里的局部提示不算），占位以外要有看得见的正文。 */
async function expectNormalBody(page: Page, entry: PageEntry): Promise<void> {
  const label = pageLabel(entry);
  await expect(async () => {
    const body = await page.evaluate(inspectMain);
    expect(body.placeholders, `${label}：正常态的正文区不应整页显示状态占位：${body.placeholders.join("、")}`).toEqual([]);
    expect(body.content, `${label}：正常态的正文区除了状态占位还应有看得见的正文`).toBe(true);
  }).toPass({ timeout: BODY_TIMEOUT_MS });
}

/** 正常态加载完以后：不应还停在整页的加载态；正文区也不应整页显示别的状态占位，占位以外要有看得见的正文。 */
export async function expectLoaded(page: Page, entry: PageEntry): Promise<void> {
  await settle(page);
  await expect(page.locator("main#main .ui-state--loading"), `${pageLabel(entry)}：加载完后不应还在加载`).toHaveCount(0);
  await expectNormalBody(page, entry);
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
