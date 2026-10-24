import type { queryClient } from "../../../apps/learner/src/api/query-client.ts";
import type { S24Progress } from "../../../packages/contract/src/generated/api/endpoints.schemas.ts";
type QueryClient = typeof queryClient;
import { createServer, request as httpRequest, type ClientRequest, type IncomingMessage, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
// S24 的页面冒烟：直接打开四个视图，核对三档布局、七态、四种考试及核心按钮。
// 业务数字来自页面假数据，文案来自本页 i18n；受限时保留完成度与健康度并隐藏预测类内容。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  expect,
  test,
  type ConsoleMessage,
  type Frame,
  type Request,
  type Response,
  type WebSocket,
  type Locator,
  type Page,
} from "@playwright/test";
import { formatCount, formatDateTime, formatNumber, formatRange, formatScore } from "../../../packages/shared/src/format/index.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { APP_URLS, ROOT } from "../support/env.ts";

const COPY: unknown = JSON.parse(readFileSync(join(ROOT, "apps/learner/src/i18n/zh-CN/S24.json"), "utf8"));
const entry = pageById("S24");
const VIEWS = ["overview", "value", "diagnosis", "calibration"] as const;
const WIDTHS = [
  { width: 375, height: 812 },
  { width: 834, height: 900 },
  { width: 1280, height: 900 },
] as const;

function copy(path: string): string {
  let value: unknown = COPY;
  for (const key of path.split(".")) {
    value = typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  }
  if (typeof value !== "string") throw new Error("S24.json 缺少文案：" + path);
  return value;
}

function mainOf(page: Page): Locator {
  return page.locator("main#main");
}

async function pressSoon(page: Page, target: Locator): Promise<void> {
  await target.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("common.soon") })).toBeVisible();
}

for (const size of WIDTHS) {
  for (const view of VIEWS) {
    test("S24 " + size.width + " 宽：" + view + " 视图可直接打开且正文不横向溢出", async ({ page }) => {
      await page.setViewportSize(size);
      const watch = await watchPage(page);
      await watch.open(urlOf(entry, { view }));
      await expectOpened(page, entry, undefined);
      await expectLoaded(page, entry);
      await expect(mainOf(page).getByRole("tab", { name: copy("tabs." + view), exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(mainOf(page).getByRole("tabpanel")).toBeVisible();
      const overflow = await mainOf(page).evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(overflow, "正文应在当前宽度内排版").toBeLessThanOrEqual(1);
      if (view === "overview") {
        const cards = mainOf(page).locator(".s24-metrics .ui-stat");
        const first = await cards.nth(0).boundingBox();
        const second = await cards.nth(1).boundingBox();
        const third = await cards.nth(2).boundingBox();
        if (!first || !second || !third) throw new Error("总览三个数未显示");
        if (size.width === 375) {
          expect(second.y, "手机三个数按顺序纵向排列").toBeGreaterThanOrEqual(first.y + first.height - 1);
          expect(third.y, "手机三个数按顺序纵向排列").toBeGreaterThanOrEqual(second.y + second.height - 1);
        } else {
          expect(second.x, "平板与桌面三个数并列").toBeGreaterThanOrEqual(first.x + first.width - 1);
          expect(third.x, "平板与桌面三个数并列").toBeGreaterThanOrEqual(second.x + second.width - 1);
        }
        const oneLine = await mainOf(page)
          .getByRole("heading", { name: copy("forecast.trend"), exact: true })
          .evaluate((el) => el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) * 1.1);
        expect(oneLine, "预测走势标题不应被按钮挤成多行").toBe(true);
      }

      expectNoProblems(watch, "normal");
    });
  }
}

test("S24 四个标签可以用键盘切换，地址保留当前视图", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  for (const view of VIEWS) {
    const tab = mainOf(page).getByRole("tab", { name: copy("tabs." + view), exact: true });
    await tab.press("Enter");
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(new RegExp("[?&]view=" + view + "(?:&|$)"));
  }
  expectNoProblems(watch, "normal");
});

for (const state of ABNORMAL_STATES) {
  test("S24 可以强制显示 " + state + " 状态", async ({ page }) => {
    const watch = await watchPage(page);
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    const shown = mainOf(page)
      .locator(".ui-state--" + state)
      .first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.title"));
      await expect(shown).toContainText(copy("state.empty.body"));
      await expect(shown.getByRole("link", { name: copy("state.empty.action"), exact: true })).toHaveAttribute("href", "/diagnosis");
      await expect(mainOf(page).getByRole("heading", { level: 1, name: entry.name, exact: true })).toBeVisible();
    }
    if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
    if (state === "restricted") {
      await expect(shown).toContainText(copy("state.restricted.body"));
      await expect(mainOf(page)).toContainText(copy("metrics.completion"));
      await expect(mainOf(page)).toContainText(copy("metrics.health"));
      await expect(shown.getByRole("link", { name: copy("state.restricted.action"), exact: true })).toHaveAttribute("href", "/map");
    }
    if (state === "insufficient_data") {
      await expect(shown).toContainText(copy("state.insufficient_data.title"));
      await expect(mainOf(page)).toContainText(copy("metrics.completion"));
      await expect(mainOf(page)).toContainText(copy("metrics.health"));
    }
    expectNoProblems(watch, state);
  });
}

test("S24 地图体检受限时，提分地图也显示修复入口", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { state: "restricted", view: "value" }));
  await expectState(page, entry, "restricted");
  await expect(mainOf(page).getByRole("heading", { name: copy("value.map"), exact: true })).toHaveCount(0);
  await expect(mainOf(page).getByRole("heading", { name: copy("value.path"), exact: true })).toHaveCount(0);
  await expect(
    mainOf(page)
      .getByRole("link", { name: copy("state.restricted.action"), exact: true })
      .first(),
  ).toHaveAttribute("href", "/map");
  expectNoProblems(watch, "restricted");
});

test("S24 四个演示考试均显示各自数据，自建地图保留体检阻断", async ({ page }) => {
  const watch = await watchPage(page);
  const index = JSON.parse(readFileSync(join(ROOT, "fixtures/exams/index.json"), "utf8")) as {
    exams: readonly { key: string; exam_id: string }[];
  };
  for (const exam of index.exams) {
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectLoaded(page, entry);
    await expect(mainOf(page)).toContainText(copy("metrics.completion"));
    await expect(mainOf(page)).toContainText(copy("metrics.health"));
    if (exam.key === "ds") {
      await expect(mainOf(page).locator(".ui-state--restricted").first()).toBeVisible();
    }
    expectNoProblems(watch, "normal", exam.key + "：");
  }
});

test("S24 总览切换统计口径与预测时点，主要按钮提供反馈", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = mainOf(page);
  await main.getByRole("radio", { name: copy("metrics.weighted"), exact: true }).press("Enter");
  await expect(main.getByRole("radio", { name: copy("metrics.weighted"), exact: true })).toHaveAttribute("aria-checked", "true");
  await main.getByRole("radio", { name: copy("metrics.workload"), exact: true }).press("Enter");
  await main.getByRole("radio", { name: copy("forecast.today"), exact: true }).press("Enter");
  await expect(main.getByRole("radio", { name: copy("forecast.today"), exact: true })).toHaveAttribute("aria-checked", "true");
  await main.getByRole("radio", { name: copy("forecast.target"), exact: true }).press("Enter");
  await pressSoon(page, main.getByRole("button", { name: copy("header.export"), exact: true }));
  await main.getByRole("button", { name: copy("header.simulate"), exact: true }).press("Enter");
  await expect(page.getByRole("dialog", { name: copy("simulation.title"), exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: copy("simulation.title"), exact: true })).toBeHidden();
  expectNoProblems(watch, "normal");
});

test("S24 提分路径可看理由；诊断操作与成绩登记有反馈", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "value" }));
  await expectLoaded(page, entry);
  await mainOf(page)
    .getByRole("button", { name: copy("value.reason"), exact: true })
    .first()
    .press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await mainOf(page)
    .getByRole("tab", { name: copy("tabs.diagnosis"), exact: true })
    .press("Enter");
  await pressSoon(page, mainOf(page).getByRole("button", { name: copy("diagnosis.proposal"), exact: true }));
  await pressSoon(
    page,
    mainOf(page)
      .getByRole("button", { name: copy("diagnosis.add_today"), exact: true })
      .first(),
  );
  await mainOf(page)
    .getByRole("tab", { name: copy("tabs.calibration"), exact: true })
    .press("Enter");
  await pressSoon(page, mainOf(page).getByRole("button", { name: copy("calibration.register"), exact: true }));
  expectNoProblems(watch, "normal");
});

interface ForecastFixture {
  readonly conservative: number;
  readonly likely: number;
  readonly optimistic: number;
  readonly confidence: string;
  readonly estimated_score_ratio: number;
  readonly weekly_change?: number;
}

interface ProgressFixture {
  readonly qualification_line?: number;
  readonly scenarios: {
    readonly insufficient_data: { readonly health_sample: { readonly observed_days: number; readonly advanced_levels: number } };
  };
  readonly computed_at: string;
  readonly time_zone: string;
  readonly forecasts: Readonly<Record<"today" | "target", ForecastFixture>>;
  readonly metrics: { readonly health: number; readonly verdict: string };
  readonly subjects: readonly { readonly name: string; readonly passed: boolean; readonly gap?: number }[];
}

const progressFixture = JSON.parse(readFileSync(join(ROOT, "fixtures/pages/S24/junior-accounting.json"), "utf8")) as ProgressFixture;

test("S24 离线重新打开无法确认目标时保留缓存，但不冒用其中数字", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "overview" }));
  await expectLoaded(page, entry);
  const updated = copy("header.updated").replace("{{time}}", formatDateTime(progressFixture.computed_at, progressFixture.time_zone));
  await expect(mainOf(page).locator(".ui-pagehead")).toContainText(updated);
  const key = "S24:progress:v3:junior-accounting";
  await expect.poll(async () => page.evaluate((key) => sessionStorage.getItem(key), key)).not.toBeNull();
  // 全局强制离线也让目标身份接口失败，旧的“当前目标”别名不能证明当前考试。
  await watch.open(urlOf(entry, { view: "overview", state: "offline" }));
  await expectState(page, entry, "offline");
  await expect(mainOf(page).locator(".ui-state--offline")).not.toHaveClass(/ui-state--compact/);
  await expect(mainOf(page).locator(".ui-stats")).toHaveCount(0);
  await expect
    .poll(async () => page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "{}").computed_at as unknown, key))
    .toBe(progressFixture.computed_at);
  expectNoProblems(watch, "offline");
});

test("S24 体检阻断后，两个时点的预测值及趋势、分值表不再渲染", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "overview" }));
  await expectLoaded(page, entry);
  const main = mainOf(page);
  const forecastStat = main
    .locator(".ui-stat")
    .filter({ hasText: copy("metrics.forecast") })
    .locator(".ui-stat__value");
  const trend = main.locator(".ui-card").filter({ has: page.getByRole("heading", { name: copy("forecast.trend"), exact: true }) });

  const today = progressFixture.forecasts.today;
  for (const at of ["today", "target"] as const) {
    await main.getByRole("radio", { name: copy("forecast." + at), exact: true }).press("Enter");
    const forecast = progressFixture.forecasts[at];
    // R06 R10a：三个数卡片固定显示“按今天的水平”；时点切换只影响预测走势卡。
    await expect(forecastStat).toHaveText(formatRange(today.conservative, today.optimistic, copy("common.score")));
    for (const value of [forecast.conservative, forecast.likely, forecast.optimistic]) {
      await expect(trend).toContainText(formatScore(value));
    }
  }

  await watch.open(urlOf(entry, { view: "overview", state: "restricted" }));
  await expectState(page, entry, "restricted");
  await expect(forecastStat).toHaveText("—");
  await expect(main.getByRole("heading", { name: copy("forecast.trend"), exact: true })).toHaveCount(0);
  await expect(main.getByRole("table", { name: copy("forecast.trend"), exact: true })).toHaveCount(0);
  await expect(main.getByRole("img", { name: copy("forecast.chart_label"), exact: true })).toHaveCount(0);
  expectNoProblems(watch, "restricted");

  await watch.open(urlOf(entry, { view: "value", state: "restricted" }));
  await expectState(page, entry, "restricted");
  await expect(main.getByRole("table", { name: copy("value.map"), exact: true })).toHaveCount(0);
  await expect(main.locator(".ui-stats")).toHaveCount(0);
  expectNoProblems(watch, "restricted");
});

test("S24 离线缓存按考试分开：看过初级会计后离线打开六级，不显示初级会计的数字", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { exam: "kj" }));
  await expectLoaded(page, entry);
  await expect.poll(async () => page.evaluate(() => sessionStorage.getItem("S24:progress:v3:junior-accounting"))).not.toBeNull();
  await watch.open(urlOf(entry, { exam: "en", state: "offline" }));
  await expectState(page, entry, "offline");
  await expect(mainOf(page).locator(".ui-state--offline")).not.toHaveClass(/ui-state--compact/);
  await expect(mainOf(page).locator(".ui-stats")).toHaveCount(0);
  expectNoProblems(watch, "offline");
});

test("S24 三个数按 R06 显示：健康度是两位小数的比值加判词，各科写离目标线还差几分", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "overview" }));
  await expectLoaded(page, entry);
  const main = mainOf(page);
  const health = main.locator(".ui-stat").filter({ hasText: copy("metrics.health") });
  await expect(health.locator(".ui-stat__value")).toHaveText(formatNumber(progressFixture.metrics.health, 2));
  await expect(health).toContainText(copy("metrics.verdict." + progressFixture.metrics.verdict));
  const table = main.getByRole("table", { name: copy("overview.subjects"), exact: true });
  for (const subject of progressFixture.subjects) {
    const status = subject.passed ? copy("forecast.reached") : copy("overview.short").replace("{{value}}", formatScore(subject.gap ?? 0));
    await expect(table).toContainText(status);
  }
  expectNoProblems(watch, "normal");
});

test("S24 按计划学到目标日已过目标线时写“已过目标线”，不显示负数差额", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { exam: "js" }));
  await expectLoaded(page, entry);
  const main = mainOf(page);
  await main.getByRole("radio", { name: copy("forecast.target"), exact: true }).press("Enter");
  const trend = main.locator(".ui-card").filter({ has: page.getByRole("heading", { name: copy("forecast.trend"), exact: true }) });
  await expect(trend).toContainText(copy("forecast.reached"));
  await expect(trend).not.toContainText("-");
  expectNoProblems(watch, "normal");
});

test("S24 样本不足时健康度只给原始天数与推进记录，不显示比值和判词", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { exam: "kj", state: "insufficient_data" }));
  await expectState(page, entry, "insufficient_data");
  const health = mainOf(page)
    .locator(".ui-stat")
    .filter({ hasText: copy("metrics.health") });
  const sample = progressFixture.scenarios.insufficient_data.health_sample;
  await expect(health.locator(".ui-stat__value")).toHaveText(copy("metrics.health_state.insufficient_data"));
  await expect(health).toContainText(
    copy("metrics.health_raw")
      .replace("{{days}}", formatCount(sample.observed_days))
      .replace("{{levels}}", formatCount(sample.advanced_levels)),
  );
  await expect(health.locator(".ui-stat__hint")).not.toContainText(copy("metrics.verdict.ok"));
  expectNoProblems(watch, "insufficient_data");
});

test("S24 预测展示置信度与较上周，合格线和目标线独立标注", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { exam: "kj" }));
  await expectLoaded(page, entry);
  const main = mainOf(page);
  const forecast = main.locator(".ui-stat").filter({ hasText: copy("metrics.forecast") });
  await expect(forecast).toContainText(copy("forecast.confidence." + progressFixture.forecasts.today.confidence));
  const change = progressFixture.forecasts.today.weekly_change;
  if (change === undefined) throw new Error("初级会计示例缺少较上周变化");
  await expect(forecast).toContainText(copy("forecast.weekly_change").replace("{{value}}", (change > 0 ? "+" : "") + formatScore(change)));
  const chart = main.getByRole("img", { name: copy("forecast.chart_label"), exact: true });
  await expect(chart).toContainText(copy("forecast.qualification_line"));
  await expect(chart).toContainText(copy("forecast.target_line"));
  await expect(main).toContainText(copy("forecast.history_basis"));
  expectNoProblems(watch, "normal");
});

test("S24 强制不足的考情降级示例在预测和提分地图都标注估算依据", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { exam: "js", state: "insufficient_data" }));
  await expectState(page, entry, "insufficient_data");
  await expect(mainOf(page)).toContainText(copy("value.estimated"));
  await mainOf(page)
    .getByRole("tab", { name: copy("tabs.value"), exact: true })
    .press("Enter");
  await expect(mainOf(page)).toContainText(copy("value.estimated"));
  await expect(mainOf(page).getByRole("table", { name: copy("value.map"), exact: true })).toContainText(copy("value.estimated_short"));
  expectNoProblems(watch, "insufficient_data");
});

const S24_PROXY_SCHEMA_PATH = "/@fs" + join(ROOT, "packages/contract/src/generated/api/endpoints.zod.ts");
const S24_PROXY_SCHEMA_PATHS = new Set([S24_PROXY_SCHEMA_PATH]);

interface S24ProxyEvent {
  readonly seq: number;
  readonly atMs: number;
  readonly kind: string;
  readonly detail: unknown;
}
interface S24ProxyError {
  readonly stage: string;
  readonly message: string;
  readonly stack?: string;
}
interface S24HeldSnapshot {
  readonly id: number;
  readonly path: string;
  readonly rawUrl: string;
  readonly pending: boolean;
  readonly upstreamCreated: boolean;
  readonly headersSent: boolean;
  readonly responseDestroyed: boolean;
  readonly requestAborted: boolean;
}
interface S24ProxyProbe {
  readonly schemaVersion: 1;
  readonly purpose: "error_schema_dependency_regression";
  readonly upstream: string;
  origin: string | null;
  browser: string;
  gateReleased: boolean;
  navigationCommitted: boolean;
  heldProven: boolean;
  errorStateVisible: boolean;
  normalRestored: boolean;
  releasedSchemaFinished: boolean;
  hmrConnected: boolean;
  regressionProven: boolean;
  wsUpgrades: number;
  beforeRelease: readonly S24HeldSnapshot[];
  readonly events: S24ProxyEvent[];
  readonly errors: S24ProxyError[];
  readonly cleanupErrors: S24ProxyError[];
}
interface S24SchemaGateProxy {
  readonly origin: string;
  snapshotHeld(): S24HeldSnapshot[];
  release(): void;
  close(): Promise<void>;
}

function s24Error(stage: string, error: unknown): S24ProxyError {
  return error instanceof Error
    ? { stage, message: error.message, ...(error.stack === undefined ? {} : { stack: error.stack }) }
    : { stage, message: String(error) };
}

/**
 * 浏览器、SW 均以随机 loopback origin 访问原 learner Vite。
 * 保留 Host/Origin、原始 path/query 和响应字节；不改 Vite/MSW/应用配置。
 * 只有生成缓存校验模块的 GET 在建立 upstream request 之前等待可释放的 gate。
 */
async function createS24SchemaGateProxy(
  probe: S24ProxyProbe,
  event: (kind: string, detail?: unknown) => void,
): Promise<S24SchemaGateProxy> {
  const upstream = new URL(APP_URLS.learner);
  if (upstream.protocol !== "http:") throw new Error("该草案仅支持现有 HTTP learner Vite");
  const sockets = new Set<Socket>();
  const requests = new Set<ClientRequest>();
  const held = new Map<
    number,
    {
      id: number;
      path: string;
      rawUrl: string;
      pending: boolean;
      upstreamCreated: boolean;
      request: IncomingMessage;
      response: ServerResponse;
    }
  >();
  let nextId = 0;
  let closing = false;
  let releaseGate!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
  const error = (stage: string, value: unknown): void => {
    const detail = s24Error(stage, value);
    probe.errors.push(detail);
    event("proxy-error", { ...detail, duringOwnClose: closing });
  };
  const trackSocket = (socket: Socket, side: string): void => {
    if (sockets.has(socket)) return;
    sockets.add(socket);
    socket.once("close", (hadError) => {
      sockets.delete(socket);
      event("socket-close", { side, hadError });
    });
    socket.on("error", (value) => error("socket:" + side, value));
  };
  const trackRequest = (request: ClientRequest): void => {
    requests.add(request);
    request.once("close", () => requests.delete(request));
    request.on("socket", (socket) => trackSocket(socket, "upstream"));
  };
  const release = (): void => {
    if (probe.gateReleased) return;
    probe.gateReleased = true;
    event("gate-release");
    releaseGate();
  };
  const snapshotHeld = (): S24HeldSnapshot[] =>
    [...held.values()].map((row) => ({
      id: row.id,
      path: row.path,
      rawUrl: row.rawUrl,
      pending: row.pending,
      upstreamCreated: row.upstreamCreated,
      headersSent: row.response.headersSent,
      responseDestroyed: row.response.destroyed,
      requestAborted: row.request.aborted,
    }));
  const writeHttpHead = (socket: { write(chunk: string): unknown }, response: IncomingMessage): void => {
    const lines = ["HTTP/" + response.httpVersion + " " + response.statusCode + " " + (response.statusMessage ?? "")];
    for (let i = 0; i < response.rawHeaders.length; i += 2) {
      lines.push(response.rawHeaders[i] + ": " + response.rawHeaders[i + 1]);
    }
    socket.write(lines.join("\r\n") + "\r\n\r\n");
  };
  const options = (request: IncomingMessage) => ({
    protocol: upstream.protocol,
    hostname: upstream.hostname,
    port: upstream.port || "80",
    method: request.method,
    path: request.url,
    // 原始多值头包括浏览器使用的 proxy Host/Origin；Vite 允许 loopback Host。
    headers: request.rawHeaders,
    agent: false as const,
  });

  const server = createServer((request, response) => {
    const id = ++nextId;
    const rawUrl = request.url ?? "/";
    const path = new URL(rawUrl, "http://127.0.0.1").pathname;
    const isSchema = request.method === "GET" && S24_PROXY_SCHEMA_PATHS.has(path);
    const row = {
      id,
      path,
      rawUrl,
      pending: false,
      upstreamCreated: false,
      request,
      response,
    };
    event("http-received", { id, method: request.method, rawUrl, headers: request.rawHeaders, isSchema });
    request.on("aborted", () => event("http-client-aborted", { id }));
    request.on("error", (value) => error("http-client:" + id, value));
    response.on("error", (value) => error("http-response:" + id, value));
    response.once("finish", () => event("http-client-finish", { id }));
    response.once("close", () => event("http-client-close", { id, headersSent: response.headersSent }));

    const forward = async (): Promise<void> => {
      if (isSchema && !probe.gateReleased) {
        row.pending = true;
        held.set(id, row);
        // 服务器唯一 hit latch：真实请求进入精确 gate 后才置位，未创建上游请求。
        event("schema-gate-hit", { id, path, rawUrl, headersSent: response.headersSent, upstreamCreated: false });
        await gate;
        row.pending = false;
      }
      if (closing || response.destroyed || request.aborted) {
        event("http-not-forwarded", { id, closing, responseDestroyed: response.destroyed, aborted: request.aborted });
        return;
      }
      row.upstreamCreated = true;
      event("http-forward", { id, path, rawUrl, gateReleased: probe.gateReleased });
      const outbound = httpRequest(options(request), (incoming) => {
        event("http-upstream-response", {
          id,
          status: incoming.statusCode,
          statusMessage: incoming.statusMessage,
          headers: incoming.rawHeaders,
        });
        incoming.on("error", (value) => {
          error("http-upstream-body:" + id, value);
          response.destroy();
        });
        incoming.once("end", () => event("http-upstream-end", { id }));
        response.writeHead(incoming.statusCode ?? 502, incoming.statusMessage, incoming.rawHeaders);
        incoming.pipe(response);
      });
      trackRequest(outbound);
      outbound.on("error", (value) => {
        error("http-upstream:" + id, value);
        if (!response.destroyed) {
          if (response.headersSent) response.destroy();
          else {
            response.writeHead(502, { "content-type": "text/plain" });
            response.end("U24 diagnostic proxy upstream failure");
          }
        }
      });
      response.once("close", () => {
        if (!response.writableFinished) outbound.destroy();
      });
      request.pipe(outbound);
    };
    void forward().catch((value: unknown) => {
      error("http-forward:" + id, value);
      if (!response.destroyed) response.destroy();
    });
  });
  server.on("connection", (socket) => trackSocket(socket, "client"));
  server.on("clientError", (value, socket) => {
    error("http-parser", value);
    socket.destroy();
  });
  server.on("error", (value) => error("server", value));

  server.on("upgrade", (request, client, head) => {
    const id = ++nextId;
    event("ws-upgrade-request", {
      id,
      rawUrl: request.url,
      headers: request.rawHeaders,
      clientHeadBytes: head.length,
    });
    const outbound = httpRequest(options(request));
    trackRequest(outbound);
    client.on("error", (value) => error("ws-client:" + id, value));
    client.once("close", () => outbound.destroy());
    outbound.on("upgrade", (incoming, remote, remoteHead) => {
      probe.wsUpgrades += 1;
      event("ws-upstream-upgrade", {
        id,
        status: incoming.statusCode,
        headers: incoming.rawHeaders,
        upstreamHeadBytes: remoteHead.length,
      });
      // 先转发真实 101/多值响应头，再双向保留 Node 已读出的首帧字节。
      writeHttpHead(client, incoming);
      if (remoteHead.length > 0) client.write(remoteHead);
      if (head.length > 0) remote.write(head);
      client.once("close", () => remote.destroy());
      remote.once("close", () => client.destroy());
      remote.on("error", (value) => {
        error("ws-upstream-socket:" + id, value);
        client.destroy();
      });
      client.pipe(remote);
      remote.pipe(client);
    });
    outbound.on("response", (incoming) => {
      error("ws-non-101:" + id, new Error("上游升级实际返回 " + incoming.statusCode));
      writeHttpHead(client, incoming);
      incoming.on("error", (value) => {
        error("ws-non-101-body:" + id, value);
        client.destroy();
      });
      incoming.pipe(client);
    });
    outbound.on("error", (value) => {
      error("ws-upstream:" + id, value);
      client.destroy();
    });
    outbound.end();
  });

  const close = async (): Promise<void> => {
    release();
    if (closing) return;
    closing = true;
    event("proxy-close-start", { sockets: sockets.size, requests: requests.size });
    const stopped = new Promise<void>((resolve) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.close((value) => {
        if (value) probe.cleanupErrors.push(s24Error("server.close", value));
        resolve();
      });
    });
    // 本 server 与全部 outbound 均由本 helper 新建，绝不触碰原 Vite 或他人连接。
    const ownedClosed = [
      ...[...requests].map((request) => new Promise<void>((resolve) => request.once("close", () => resolve()))),
      ...[...sockets].map((socket) => new Promise<void>((resolve) => socket.once("close", () => resolve()))),
    ];
    for (const request of requests) request.destroy();
    for (const socket of sockets) socket.destroy();
    await Promise.all([stopped, ...ownedClosed]);
    event("proxy-close-complete", { sockets: sockets.size, requests: requests.size });
    if (sockets.size !== 0 || requests.size !== 0) {
      probe.cleanupErrors.push(s24Error("owned-connections", new Error("本代理自有连接尚未全部关闭")));
    }
    server.removeAllListeners();
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (value: Error): void => {
        reject(value);
      };
      server.once("error", onError);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", onError);
        resolve();
      });
    });
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("未取得 loopback TCP 端口");
    const origin = "http://127.0.0.1:" + address.port;
    probe.origin = origin;
    event("proxy-listening", { origin, upstream: upstream.href });
    return { origin, snapshotHeld, release, close };
  } catch (value) {
    await close();
    throw value;
  }
}

test("S24 出错态不等待离线缓存校验模块", async ({ page, context, browserName }, testInfo) => {
  const started = performance.now();
  const probe: S24ProxyProbe = {
    schemaVersion: 1,
    purpose: "error_schema_dependency_regression",
    upstream: APP_URLS.learner,
    origin: null,
    browser: browserName,
    gateReleased: false,
    navigationCommitted: false,
    heldProven: false,
    errorStateVisible: false,
    normalRestored: false,
    releasedSchemaFinished: false,
    hmrConnected: false,
    regressionProven: false,
    wsUpgrades: 0,
    beforeRelease: [],
    events: [],
    errors: [],
    cleanupErrors: [],
  };
  const event = (kind: string, detail: unknown = null): void => {
    probe.events.push({ seq: probe.events.length + 1, atMs: performance.now() - started, kind, detail });
  };
  const ids = new WeakMap<Request, number>();
  let nextBrowserId = 0;
  const requestId = (request: Request): number => {
    let id = ids.get(request);
    if (id === undefined) {
      id = ++nextBrowserId;
      ids.set(request, id);
    }
    return id;
  };
  const scope = (url: string): boolean => {
    try {
      return probe.origin !== null && new URL(url).origin === probe.origin;
    } catch {
      return false;
    }
  };
  const browserErrors: S24ProxyError[] = [];
  const onRequest = (request: Request): void => {
    event("browser-request", {
      id: requestId(request),
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
    });
    if (new URL(request.url()).origin === new URL(APP_URLS.learner).origin) {
      browserErrors.push(s24Error("proxy-origin-escape", new Error(request.url())));
    }
  };
  const onResponse = (response: Response): void => {
    const request = response.request();
    event("browser-response", {
      id: requestId(request),
      url: response.url(),
      status: response.status(),
      resourceType: request.resourceType(),
      fromServiceWorker: response.fromServiceWorker(),
      proxyOrigin: scope(response.url()),
    });
    if (scope(response.url()) && new URL(response.url()).pathname === S24_PROXY_SCHEMA_PATH) {
      void response
        .finished()
        .then((failure) => {
          event("schema-response-finished", { url: response.url(), status: response.status(), failure });
          if (response.status() === 200 && failure === null) probe.releasedSchemaFinished = true;
          else probe.errors.push(s24Error("schema-response", new Error("释放的校验模块未完整返回200")));
        })
        .catch((value: unknown) => {
          probe.errors.push(s24Error("schema-response-finished", value));
        });
    }
  };
  const onRequestFailed = (request: Request): void => {
    event("browser-request-failed", { id: requestId(request), url: request.url(), failure: request.failure() });
    // 取消请求仍完整记录；应用报错按原 shared watchPage/expectNoProblems 判断，不能把 StrictMode 取消一律当异常。
  };
  const onPageError = (value: Error): void => {
    browserErrors.push(s24Error("pageerror", value));
  };
  const onConsole = (message: ConsoleMessage): void => {
    event("browser-console", { type: message.type(), text: message.text(), location: message.location() });
    // 原 shared watch 按当前正常/出错态核对控制台错误，预期500不被误报。
  };
  const onNavigated = (frame: Frame): void => {
    if (frame === page.mainFrame()) event("browser-main-navigation", { url: frame.url() });
  };
  const disposeWebSockets: (() => void)[] = [];
  const onWebSocket = (socket: WebSocket): void => {
    event("browser-ws-open", { url: socket.url() });
    const onError = (value: string): void => {
      event("browser-ws-error", { url: socket.url(), error: value });
      browserErrors.push(s24Error("websocket", new Error(value)));
    };
    const onFrame = (frame: { payload: string | Buffer }): void => {
      const text = typeof frame.payload === "string" ? frame.payload : frame.payload.toString("base64");
      event("browser-ws-frame", { url: socket.url(), text });
      try {
        const parsed: unknown = JSON.parse(text);
        const sameHost = probe.origin !== null && new URL(socket.url()).host === new URL(probe.origin).host;
        if (sameHost && typeof parsed === "object" && parsed !== null && "type" in parsed && parsed.type === "connected") {
          probe.hmrConnected = true;
        }
      } catch {
        /* 非 JSON/二进制帧仍原样记录。 */
      }
    };
    const onClose = (): void => {
      event("browser-ws-close", { url: socket.url() });
    };
    socket.on("socketerror", onError);
    socket.on("framereceived", onFrame);
    socket.on("close", onClose);
    disposeWebSockets.push(() => {
      socket.off("socketerror", onError);
      socket.off("framereceived", onFrame);
      socket.off("close", onClose);
    });
  };
  context.on("request", onRequest);
  context.on("response", onResponse);
  context.on("requestfailed", onRequestFailed);
  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  page.on("framenavigated", onNavigated);
  page.on("websocket", onWebSocket);

  let proxy: S24SchemaGateProxy | undefined;
  let watch: Awaited<ReturnType<typeof watchPage>> | undefined;
  let normalTarget: string | undefined;
  let errorNavigationCurrent = true;
  let primaryError: unknown;
  let primaryFailed = false;
  const entry = pageById("S24");
  const attach = async (name: string): Promise<void> => {
    await testInfo.attach(name, {
      body: Buffer.from(
        JSON.stringify(
          {
            ...probe,
            currentHeld: proxy?.snapshotHeld() ?? [],
            browserErrors,
          },
          null,
          2,
        ),
      ),
      contentType: "application/json",
    });
  };
  try {
    watch = await watchPage(page);
    proxy = await createS24SchemaGateProxy(probe, event);
    const target = new URL(urlOf(entry, { state: "error" }));
    target.host = new URL(proxy.origin).host;
    const normal = new URL(urlOf(entry, { view: "overview" }));
    normal.host = target.host;
    normalTarget = normal.href;
    const response = await page.goto(target.href, { waitUntil: "commit" });
    probe.navigationCommitted = response !== null;
    event("navigation-committed", { url: page.url(), status: response?.status() ?? null });
    expect(response?.ok(), "代理导航实际应成功").toBe(true);
    await expectOpened(page, entry, undefined);
    event("error-assertion-start");
    await expectState(page, entry, "error"); // 原共享正确断言与默认5000ms，不能等待校验模块释放。
    probe.errorStateVisible = true;
    event("error-state-visible");
    expectNoProblems(watch, "error");
    expect(proxy.snapshotHeld(), "冷启动出错态不应请求离线缓存校验模块").toEqual([]);

    // 同一gate的正控制：正常首屏已经可用，后台预取校验器仍可被真实留住。
    watch = await watchPage(page);
    await page.goto(normalTarget, { waitUntil: "commit" });
    errorNavigationCurrent = false;
    await expectOpened(page, entry, undefined);
    await expectLoaded(page, entry);
    await expect(page.locator("main#main").getByRole("tabpanel")).toBeVisible();
    await expect
      .poll(() => proxy?.snapshotHeld().some((row) => row.path === S24_PROXY_SCHEMA_PATH && row.pending) ?? false, {
        message: "正常成功后的后台校验器预取必须命中同一服务器gate",
      })
      .toBe(true);
    const held = proxy.snapshotHeld();
    expect(probe.gateReleased, "正常首屏可用时gate仍应关闭").toBe(false);
    expect(held.length).toBeGreaterThan(0);
    expect(
      held.every((row) => row.pending && !row.upstreamCreated && !row.headersSent && !row.responseDestroyed && !row.requestAborted),
      "预取必须真实留在服务器且未发响应",
    ).toBe(true);
    probe.beforeRelease = held;
    probe.heldProven = true;
    event("normal-visible-with-schema-held", held);
  } catch (value) {
    primaryFailed = true;
    primaryError = value;
    event("primary-failure", s24Error("regression", value));
  } finally {
    try {
      const held = proxy?.snapshotHeld() ?? [];
      probe.beforeRelease = held;
      if (!probe.gateReleased && held.length > 0 && held.every((row) => row.pending && !row.upstreamCreated && !row.headersSent)) {
        probe.heldProven = true;
        event("held-before-release", held);
      }
      try {
        await attach("s24-proxy-regression-before-release");
      } catch (value) {
        probe.cleanupErrors.push(s24Error("attach-before-release", value));
      } finally {
        proxy?.release(); // 附件、断言、导航失败均不能阻止 gate 释放。
      }
      if (proxy !== undefined && probe.navigationCommitted && !page.isClosed()) {
        try {
          if (errorNavigationCurrent) {
            await expectState(page, entry, "error");
            expect(watch !== undefined && normalTarget !== undefined, "恢复目标须已建立").toBe(true);
            if (watch !== undefined && normalTarget !== undefined) {
              expectNoProblems(watch, "error");
              watch = await watchPage(page);
              await page.goto(normalTarget, { waitUntil: "commit" });
              errorNavigationCurrent = false;
            }
          }
          await expectLoaded(page, entry); // 保留原 settle 和正文断言/时限。
          await expect(page.locator("main#main").getByRole("tabpanel")).toBeVisible();
          await expect
            .poll(() => probe.wsUpgrades > 0 && probe.hmrConnected, {
              message: "代理必须真实转发 Vite 101 并收到 connected，不能靠直连 fallback",
            })
            .toBe(true);
          expect(watch, "原 shared 页面观察器须已建立").toBeDefined();
          if (watch !== undefined) expectNoProblems(watch, "normal");
          expect(browserErrors, "正常恢复不得有 JS/网络/HMR 或逃逸代理错误").toEqual([]);
          await expect
            .poll(() => probe.releasedSchemaFinished, {
              message: "释放后校验模块必须真实返回200且响应体完成，才能确认后台预热恢复",
            })
            .toBe(true);
          // 顶层200/body完成后，传递依赖（如zod）还可能在途；同一import完整求值后才能关闭代理。
          await page.evaluate(async (path) => {
            await import(path);
          }, S24_PROXY_SCHEMA_PATH);
          event("schema-module-evaluated");
          expect(probe.errors, "代理运行错误必须为空").toEqual([]);
          probe.normalRestored = true;
          event("normal-restored");
        } catch (value) {
          probe.cleanupErrors.push(s24Error("normal-recovery", value));
        }
      } else {
        probe.cleanupErrors.push(s24Error("normal-recovery", new Error("未 commit 或页面已关闭，无法确认同页正常恢复")));
      }
    } finally {
      // 仅移除本回归 自己注册的监听；关闭代理造成的浏览器断连不混入恢复断言。
      context.off("request", onRequest);
      context.off("response", onResponse);
      context.off("requestfailed", onRequestFailed);
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
      page.off("framenavigated", onNavigated);
      page.off("websocket", onWebSocket);
      for (const dispose of disposeWebSockets) dispose();
      if (proxy !== undefined) {
        try {
          await proxy.close();
        } catch (value) {
          probe.cleanupErrors.push(s24Error("proxy-close", value));
        }
      }
      probe.regressionProven =
        !primaryFailed &&
        probe.errorStateVisible &&
        probe.heldProven &&
        probe.normalRestored &&
        probe.releasedSchemaFinished &&
        probe.errors.length === 0 &&
        probe.cleanupErrors.length === 0 &&
        browserErrors.length === 0;
      event("regression-final", { regressionProven: probe.regressionProven });
      try {
        await attach("s24-proxy-regression-final");
      } catch (value) {
        probe.regressionProven = false;
        probe.cleanupErrors.push(s24Error("attach-final", value));
      }
    }
  }
  // 首个真实失败优先保留；恢复/清理失败另存探针，不覆盖首因或偷报通过。
  if (primaryFailed) throw primaryError;
  expect(probe.cleanupErrors, "恢复与清理必须完整").toEqual([]);
  expect(probe.errors, "包括关闭阶段在内的代理错误必须为空").toEqual([]);
  expect(probe.regressionProven, "错误态必须独立显示、正常首屏不等后台校验器且释放后完整恢复").toBe(true);
});

test("S24 在线预热后真实断网仍可读取已确认目标的缓存", async ({ page, context }) => {
  const sample = JSON.parse(readFileSync(join(ROOT, "fixtures/pages/S24/junior-accounting.json"), "utf8")) as S24Progress;
  const schemaResponse = page.waitForResponse((response) => new URL(response.url()).pathname === S24_PROXY_SCHEMA_PATH);
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { exam: "kj" }));
  await expectLoaded(page, entry);
  const response = await schemaResponse;
  expect(response.status()).toBe(200);
  await response.finished();
  const cacheKey = "S24:progress:v3:" + sample.exam_id;
  await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key) !== null, cacheKey)).toBe(true);
  const cached = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null") as S24Progress, cacheKey);
  expect(cached.exam_id).toBe(sample.exam_id);
  // 只等待应用已经发起的同一模块预热完成，再切到真实浏览器离线。
  await page.evaluate(async (path) => {
    await import(path);
  }, S24_PROXY_SCHEMA_PATH);
  await context.setOffline(true);
  try {
    await page.evaluate(
      async ({ clientPath, contractPath }) => {
        const { queryClient } = (await import(clientPath)) as { queryClient: QueryClient };
        const { getGetS24ProgressQueryKey } = (await import(contractPath)) as { getGetS24ProgressQueryKey(): readonly string[] };
        // 仅清掉本标签页的进度查询数据，保留已新鲜确认的目标和session缓存；不手写请求。
        void queryClient.resetQueries({ queryKey: getGetS24ProgressQueryKey() });
      },
      { clientPath: "/src/api/query-client.ts", contractPath: "/@fs" + join(ROOT, "packages/contract/src/index.ts") },
    );
    await expect(mainOf(page).locator(".ui-state--offline")).toBeVisible();
    await expect(mainOf(page).getByRole("tabpanel")).toBeVisible();
    await expect(mainOf(page)).toContainText(formatDateTime(cached.computed_at, cached.time_zone));
    await expect(mainOf(page)).toContainText(copy("metrics.completion"));
    expectNoProblems(watch, "offline");
  } finally {
    await context.setOffline(false);
  }
});

interface S24TransportRow {
  id: number;
  aborted: boolean;
  finished: boolean;
  status: number | null;
  error: string | null;
}
interface S24TransportGate {
  contextCalls: number;
  progressCalls: number;
  contextReleased: boolean;
  held: S24TransportRow[];
  releaseContext(): void;
  releaseProgress(): void;
}

test("S24 确认目标时不把进度只读请求的取消传给假数据层", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    let releaseContext = (): void => undefined;
    let releaseProgress = (): void => undefined;
    const contextGate = new Promise<void>((resolve) => {
      releaseContext = resolve;
    });
    const progressGate = new Promise<void>((resolve) => {
      releaseProgress = resolve;
    });
    const probe: S24TransportGate = {
      contextCalls: 0,
      progressCalls: 0,
      contextReleased: false,
      held: [],
      releaseContext: () => {
        probe.contextReleased = true;
        releaseContext();
      },
      releaseProgress: () => {
        releaseProgress();
      },
    };
    (window as unknown as { __s24Transport: S24TransportGate }).__s24Transport = probe;
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : undefined;
      const url = new URL(request?.url ?? String(input), location.href);
      if (url.pathname === "/api/v1/me/context") {
        probe.contextCalls += 1;
        await contextGate;
      }
      if (url.pathname !== "/api/v1/learner/progress") return nativeFetch(input, init);
      probe.progressCalls += 1;
      if (probe.contextReleased) return nativeFetch(input, init);
      const signal = init?.signal ?? request?.signal;
      const row: S24TransportRow = {
        id: probe.progressCalls,
        aborted: signal?.aborted ?? false,
        finished: false,
        status: null,
        error: null,
      };
      probe.held.push(row);
      const onAbort = (): void => {
        row.aborted = true;
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        await progressGate;
        // 原参数和信号原样交给真实fetch；不伪造响应，也不绕过MSW。
        const response = await nativeFetch(input, init);
        row.status = response.status;
        await response.clone().arrayBuffer();
        return response;
      } catch (value) {
        row.error = value instanceof Error ? value.name + ": " + value.message : String(value);
        throw value;
      } finally {
        row.finished = true;
        signal?.removeEventListener("abort", onAbort);
      }
    };
  });
  const snapshot = () =>
    page.evaluate(() => {
      const probe = (window as unknown as { __s24Transport: S24TransportGate }).__s24Transport;
      return {
        contextCalls: probe.contextCalls,
        progressCalls: probe.progressCalls,
        contextReleased: probe.contextReleased,
        held: probe.held,
      };
    });
  const watch = await watchPage(page);
  let selectedId: number | undefined;
  let primaryError: unknown;
  let primaryFailed = false;
  const cleanupErrors: string[] = [];
  try {
    await page.goto(urlOf(entry, { exam: "kj" }), { waitUntil: "commit" });
    await expectOpened(page, entry, undefined);
    await expect
      .poll(
        async () => {
          const probe = await snapshot();
          return probe.contextCalls > 0 && probe.held.some((row) => !row.aborted && !row.finished);
        },
        { message: "上下文与仍有效的进度请求必须同时命中装置" },
      )
      .toBe(true);
    // StrictMode 首次挂载可能已取消；只跟踪此时仍有效、随后因目标确认被替换的查询。
    const before = await page.evaluate(async (clientPath) => {
      const { queryClient } = (await import(clientPath)) as { queryClient: QueryClient };
      const probe = (window as unknown as { __s24Transport: S24TransportGate }).__s24Transport;
      const selectedId = probe.held.findLast((row) => !row.aborted && !row.finished)?.id;
      const activeSlots = queryClient
        .getQueryCache()
        .findAll({ queryKey: ["/learner/progress"] })
        .filter((query) => query.getObserversCount() > 0)
        .map((query) => query.queryKey.at(-1));
      const result = { selectedId, activeSlots, progressCalls: probe.progressCalls };
      // 选择仍有效请求与释放上下文在同一同步段完成，避免夹入StrictMode取消。
      probe.releaseContext();
      return result;
    }, "/src/api/query-client.ts");
    selectedId = before.selectedId;
    expect(selectedId).toBeDefined();
    expect(before.activeSlots, "释放上下文时实际活跃查询必须仍是未确认目标").toEqual(["current"]);
    await expectLoaded(page, entry);
    await expect(mainOf(page).getByRole("tabpanel")).toBeVisible();
    await expect
      .poll(async () => (await snapshot()).progressCalls, {
        message: "确认目标后必须真实发起新的生成钩子请求",
      })
      .toBeGreaterThan(before.progressCalls);
    expect((await snapshot()).held.find((row) => row.id === selectedId)?.aborted, "目标确认只取消旧查询结果，不应中断底层只读GET").toBe(
      false,
    );
    expectNoProblems(watch, "normal");
  } catch (value) {
    primaryFailed = true;
    primaryError = value;
  } finally {
    try {
      await testInfo.attach("s24-transport-before-release", {
        body: Buffer.from(JSON.stringify({ selectedId, ...(await snapshot()) }, null, 2)),
        contentType: "application/json",
      });
    } catch (value) {
      cleanupErrors.push(value instanceof Error ? value.message : String(value));
    } finally {
      try {
        await page.evaluate(() => {
          const probe = (window as unknown as { __s24Transport: S24TransportGate }).__s24Transport;
          probe.releaseContext();
          probe.releaseProgress();
        });
      } catch (value) {
        cleanupErrors.push(value instanceof Error ? value.message : String(value));
      }
    }
    try {
      await expect
        .poll(async () => (await snapshot()).held.every((row) => row.finished), {
          message: "最后必须释放全部旧请求并等到真实传输结束",
        })
        .toBe(true);
      await testInfo.attach("s24-transport-final", {
        body: Buffer.from(JSON.stringify({ selectedId, ...(await snapshot()) }, null, 2)),
        contentType: "application/json",
      });
    } catch (value) {
      cleanupErrors.push(value instanceof Error ? value.message : String(value));
    }
  }
  if (primaryFailed) throw primaryError;
  expect(cleanupErrors, "请求释放与清理必须完成").toEqual([]);
  const final = (await snapshot()).held.find((row) => row.id === selectedId);
  expect(final?.status, "释放的旧GET也必须真实返回200").toBe(200);
  expect(final?.error).toBeNull();
  const sample = JSON.parse(readFileSync(join(ROOT, "fixtures/pages/S24/junior-accounting.json"), "utf8")) as S24Progress;
  const queries = await page.evaluate(async (clientPath) => {
    const { queryClient } = (await import(clientPath)) as { queryClient: QueryClient };
    return queryClient
      .getQueryCache()
      .findAll({ queryKey: ["/learner/progress"] })
      .map((query) => ({
        slot: query.queryKey.at(-1),
        observers: query.getObserversCount(),
        data: query.state.data as S24Progress | undefined,
      }));
  }, "/src/api/query-client.ts");
  expect(queries.filter((query) => query.observers > 0).map((query) => query.slot)).toEqual([sample.exam_id]);
  const oldQuery = queries.find((query) => query.slot === "current");
  expect(oldQuery?.observers).toBe(0);
  expect(oldQuery?.data, "旧查询迟到的200也必须被丢弃").toBeUndefined();
  expect(queries.find((query) => query.slot === sample.exam_id)?.data?.computed_at).toBe(sample.computed_at);
  const cached = await page.evaluate(
    (id) => JSON.parse(sessionStorage.getItem("S24:progress:v3:" + id) ?? "null") as S24Progress,
    sample.exam_id,
  );
  expect(cached.exam_id).toBe(sample.exam_id);
  expect(cached.computed_at).toBe(sample.computed_at);
  await expect(mainOf(page).getByRole("tabpanel")).toBeVisible();
  expectNoProblems(watch, "normal");
});
