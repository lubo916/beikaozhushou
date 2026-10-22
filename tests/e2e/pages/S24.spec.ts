// S24 的页面冒烟：直接打开四个视图，核对三档布局、七态、四种考试及核心按钮。
// 业务数字来自页面假数据，文案来自本页 i18n；受限时保留完成度与健康度并隐藏预测类内容。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { formatDateTime, formatNumber, formatRange, formatScore } from "../../../packages/shared/src/format/index.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

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
}

interface ProgressFixture {
  readonly computed_at: string;
  readonly time_zone: string;
  readonly forecasts: Readonly<Record<"today" | "target", ForecastFixture>>;
  readonly metrics: { readonly health: number; readonly verdict: string };
  readonly subjects: readonly { readonly name: string; readonly passed: boolean; readonly gap?: number }[];
}

const progressFixture = JSON.parse(readFileSync(join(ROOT, "fixtures/pages/S24/junior-accounting.json"), "utf8")) as ProgressFixture;

test("S24 正常查看后重新离线打开，缓存保留三个数和原计算时间", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "overview" }));
  await expectLoaded(page, entry);
  const values = mainOf(page).locator(".ui-stats").first().locator(".ui-stat__value");
  await expect(values).toHaveCount(3);
  const originalValues = await values.allTextContents();
  const updated = copy("header.updated").replace("{{time}}", formatDateTime(progressFixture.computed_at, progressFixture.time_zone));
  await expect(mainOf(page).locator(".ui-pagehead")).toContainText(updated);
  await expect
    // 地址没写考试：存进“当前目标”这一格（不冒充初级会计，见 data.ts 与单元测试“离线缓存”）。
    .poll(async () => page.evaluate(() => sessionStorage.getItem("S24:progress:v2:current")))
    .not.toBeNull();

  // goto 会重新加载页面模块，确保这里验证的是 sessionStorage，而非本次页面内的查询内存。
  await watch.open(urlOf(entry, { view: "overview", state: "offline" }));
  await expectState(page, entry, "offline");
  await expect(mainOf(page).locator(".ui-state--offline")).toHaveClass(/ui-state--compact/);
  await expect(values).toHaveText(originalValues);
  await expect(mainOf(page).locator(".ui-pagehead")).toContainText(updated);
  await expect(mainOf(page).getByRole("tabpanel")).toBeVisible();
  expectNoProblems(watch, "offline");
});

test("S24 体检阻断后，两个时点的预测值及趋势、分值表不再渲染", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "overview" }));
  await expectLoaded(page, entry);
  const main = mainOf(page);
  const forecastStat = main.locator(".ui-stat").filter({ hasText: copy("metrics.forecast") }).locator(".ui-stat__value");
  const trend = main.locator(".ui-card").filter({ has: main.getByRole("heading", { name: copy("forecast.trend"), exact: true }) });

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
  await expect.poll(async () => page.evaluate(() => sessionStorage.getItem("S24:progress:v2:kj"))).not.toBeNull();
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
  const trend = main.locator(".ui-card").filter({ has: main.getByRole("heading", { name: copy("forecast.trend"), exact: true }) });
  await expect(trend).toContainText(copy("forecast.reached"));
  await expect(trend).not.toContainText("-");
  expectNoProblems(watch, "normal");
});
