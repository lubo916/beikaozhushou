// S07 学习计划：全部视图、七态、三档布局、四考试与主要操作。
// 所有业务数字均由页面接口提供；这里只验证内容呈现与交互边界。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S07.json");

const entry = pageById("S07");
const VIEWS = ["week", "scope", "ranking", "log", "calendar", "rounds", "today", "sandbox"] as const;
const EXAMS = (
  JSON.parse(readFileSync(join(ROOT, "fixtures/exams/index.json"), "utf8")) as {
    exams: { key: string; exam_id: string }[];
  }
).exams;

interface PageFixture {
  readonly exam_name: string;
  readonly scope: readonly { readonly id: string; readonly name: string }[];
  readonly forecast_available: boolean;
}

function fixtureOf(examId: string): PageFixture {
  return JSON.parse(readFileSync(join(ROOT, "fixtures/pages/S07", `${examId}.json`), "utf8")) as PageFixture;
}

function copy(path: string, values: Readonly<Record<string, string | number>> = {}): string {
  let node: unknown = COPY;
  for (const key of path.split(".")) {
    node = typeof node === "object" && node !== null ? (node as Record<string, unknown>)[key] : undefined;
  }
  if (typeof node !== "string") throw new Error(`S07.json 没有文案 ${path}`);
  return node.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole: string, name: string) => (values[name] === undefined ? whole : String(values[name])));
}

function button(page: Page, path: string): Locator {
  return page
    .locator("main#main")
    .getByRole("button", { name: copy(path), exact: true })
    .first();
}

async function expectNoOverflow(page: Page): Promise<void> {
  const overflow = await page.locator("main#main").evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow, "正文区不应横向溢出").toBeLessThanOrEqual(1);
}

const VIEW_TITLES = {
  week: "week.title",
  scope: "scope.title",
  ranking: "ranking.title",
  log: "log.title",
  calendar: "calendar.title",
  today: "today.title",
} as const;

for (const view of VIEWS) {
  test(`S07 视图 ${view} 可直接打开，独有内容正确且轮次路线常驻`, async ({ page }) => {
    const watch = await watchPage(page);
    await watch.open(urlOf(entry, { view }));
    if (view === "sandbox") {
      const dialog = page.locator("dialog[open]");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { name: copy("sandbox.title"), exact: true })).toBeVisible();
      await expect(dialog).toContainText(copy("sandbox.description"));
      await dialog.press("Escape");
      await expect(dialog).toBeHidden();
    }
    await expectOpened(page, entry, undefined);
    await expectLoaded(page, entry);
    await expect(page.getByRole("heading", { level: 1, name: entry.name, exact: true })).toBeVisible();
    await expect(page.getByTestId("round-timeline")).toBeVisible();
    if (view === "rounds") {
      await expect(button(page, "timeline.add")).toBeVisible();
      await expect(button(page, "timeline.sprint")).toBeVisible();
      await expect(page.locator("main#main summary").first()).toHaveText(copy("timeline.summary"));
    } else if (view !== "sandbox") {
      await expect(page.locator("main#main").getByRole("heading", { name: copy(VIEW_TITLES[view]), exact: true })).toBeVisible();
    }
    expectNoProblems(watch, "normal");
  });
}

for (const width of [375, 834, 1280]) {
  test(`S07 ${width} 宽：本周与复习日历不溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry, { view: "week" }));
    await expectLoaded(page, entry);
    await expect(page.getByTestId("week-grid").locator(":scope > *")).toHaveCount(7);
    const weekColumns = await page
      .getByTestId("week-grid")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(weekColumns, "本周安排在手机、平板、桌面分别排成二、四、七列").toBe(width === 375 ? 2 : width === 834 ? 4 : 7);
    await expectNoOverflow(page);
    expectNoProblems(watch, "normal");
    await watch.open(urlOf(entry, { view: "calendar" }));
    await expectLoaded(page, entry);
    await expect(page.getByTestId("review-calendar-grid")).toBeVisible();
    const columns = await page
      .getByTestId("review-calendar-grid")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(columns, "复习日历在手机、平板、桌面分别排成二、四、七列").toBe(width === 375 ? 2 : width === 834 ? 4 : 7);
    await expectNoOverflow(page);
    expectNoProblems(watch, "normal");
  });
}

// 回归：手机隐藏表头后，每一格必须显示实际的 ::before 字段标签，不能只剩没有含义的数值。
const STACKED_TABLES = [
  { view: "scope", fields: ["name", "state", "target", "gap", "minutes", "action"] },
  { view: "ranking", fields: ["rank", "name", "score", "frequency", "gap", "prerequisite", "minutes", "star"] },
] as const;

for (const { view, fields } of STACKED_TABLES) {
  test(`S07 375 宽：${view} 堆叠表格的每一列均显示中文字段标签`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry, { view }));
    await expectLoaded(page, entry);
    const table = page
      .locator("main#main")
      .getByRole("region", { name: copy(`${view}.title`), exact: true })
      .locator("table");
    const rows = table.locator("tbody tr");
    const rowCount = await rows.count();
    expect(rowCount, "演示数据应有可检查的表格行").toBeGreaterThan(0);
    const expected = fields.map((field) => copy(`${view}.${field}`));
    for (let index = 0; index < rowCount; index += 1) {
      const row = rows.nth(index);
      await expect(row, "手机表格应切换成堆叠卡片").toHaveCSS("display", "grid");
      const cells = row.locator("td");
      await expect(cells).toHaveCount(fields.length);
      const labels = await cells.evaluateAll((elements) =>
        elements.map((element) => {
          const content = getComputedStyle(element, "::before").content;
          return content === "none" || content === "normal" ? content : (JSON.parse(content) as unknown);
        }),
      );
      expect(labels, `${view} 第 ${index + 1} 行：每个值旁应显示对应中文字段名`).toEqual(expected);
    }
    await expectNoOverflow(page);
    expectNoProblems(watch, "normal");
  });
}

test("S07 七态均可强制显示，局部限制保留学习计划，离线只读", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    if (state === "restricted" || state === "insufficient_data") {
      await expect(page.getByRole("heading", { level: 1, name: entry.name, exact: true })).toBeVisible();
      await expect(page.getByTestId("round-timeline")).toBeVisible();
    }
    if (state === "offline") {
      await expect(page.locator("main#main .ui-state--offline")).toContainText(copy("state.offline.body"));
      // 离线只读：重排与试算的入口不能点，页面不发写请求也不试算。
      await expect(button(page, "header.sandbox")).toBeDisabled();
      await expect(button(page, "header.leave")).toBeDisabled();
      await expect(page.locator("dialog[open]")).toBeHidden();
    }
    if (state === "empty") await expect(page.locator("main#main .ui-state--empty")).toContainText(copy("state.empty.body"));
    expectNoProblems(watch, state);
  }
});

test("S07 四个演示考试展示各自的中文目标名称与范围知识点", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    const fixture = fixtureOf(exam.exam_id);
    const point = fixture.scope[0];
    if (point === undefined) throw new Error(`${exam.exam_id} 缺少范围示例`);
    await watch.open(urlOf(entry, { exam: exam.key, view: "scope" }));
    await expectLoaded(page, entry);
    await expect(page.locator("main#main .ui-pagehead")).toContainText(copy("header.exam", { name: fixture.exam_name }));
    await expect(page.getByTestId("round-timeline")).toBeVisible();
    await expect(page.locator("main#main").getByRole("link", { name: point.name, exact: true })).toHaveAttribute("href", `/kp/${point.id}`);
    expectNoProblems(watch, "normal", `${exam.key}：`);
  }
});

test("S07 五个主要标签可切换，周任务写操作只提示，更多菜单可用", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const tabs = page.locator("main#main").getByRole("tab");
  await expect(tabs).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await tabs.nth(index).press("Enter");
    await expect(tabs.nth(index)).toHaveAttribute("aria-selected", "true");
  }
  await watch.open(urlOf(entry, { view: "week" }));
  await expectLoaded(page, entry);
  await button(page, "timeline.edit").press("Enter");
  await expect(page).toHaveURL(/[?&]view=rounds(?:&|$)/);
  await expect(button(page, "timeline.add")).toBeVisible();
  const roundsEdit = page
    .locator("main#main .ui-card")
    .filter({ has: page.locator("summary") })
    .first()
    .getByRole("button", { name: copy("timeline.edit"), exact: true });
  await roundsEdit.press("Enter");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: copy("soon") })
      .first(),
  ).toBeVisible();
  await watch.open(urlOf(entry, { view: "week" }));
  await expectLoaded(page, entry);
  for (const path of ["week.lock", "week.move"]) {
    await page
      .locator("main#main")
      .getByRole("button", { name: copy(path), exact: true })
      .and(page.locator("button:enabled"))
      .first()
      .press("Enter");
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: copy("soon") })
        .first(),
    ).toBeVisible();
  }
  await button(page, "header.more").press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const item = menu.getByRole("menuitem", { name: copy("header.sync"), exact: true });
  await expect(item).toBeVisible();
  await item.press("Enter");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: copy("soon") })
      .first(),
  ).toBeVisible();
  expectNoProblems(watch, "normal");
});

test("S07 沙盘可填输入并试算，采用前保持待确认，关闭后不改周计划", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const before = await page.getByTestId("week-grid").innerText();
  await button(page, "header.sandbox").press("Enter");
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toBeVisible();
  const preset = dialog.getByRole("combobox", { name: copy("sandbox.preset"), exact: true });
  await expect(preset).toBeVisible();
  const secondPreset = await preset.locator("option").nth(1).getAttribute("value");
  if (secondPreset === null) throw new Error("沙盘缺少预设方案");
  await preset.selectOption(secondPreset);
  await dialog.getByRole("textbox", { name: copy("sandbox.input"), exact: true }).fill("工作日少学一点，把新学移到周末");
  await dialog.getByRole("button", { name: copy("sandbox.calculate"), exact: true }).press("Enter");
  await expect(dialog.locator(".ui-proposal")).toBeVisible();
  await expect(dialog.getByText("待确认", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: copy("sandbox.adopt"), exact: true }).press("Enter");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: copy("soon") })
      .first(),
  ).toBeVisible();
  await dialog.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await page.getByTestId("week-grid").innerText()).toBe(before);
  await button(page, "header.leave").press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(copy("leave.start"), { exact: true }).fill("2026-10-23");
  await dialog.getByLabel(copy("leave.end"), { exact: true }).fill("2026-10-25");
  await dialog.getByRole("textbox", { name: copy("leave.reason"), exact: true }).fill("出差期间保留到期复习");
  await dialog.getByRole("button", { name: copy("leave.preview"), exact: true }).press("Enter");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: copy("soon") })
      .first(),
  ).toBeVisible();
  await dialog.press("Escape");
  await expect(dialog).toBeHidden();
  expectNoProblems(watch, "normal");
});

test("S07 请假生成反馈显示在活动对话框内", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  await button(page, "header.leave").press("Enter");
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(copy("leave.start"), { exact: true }).fill("2026-10-23");
  await dialog.getByLabel(copy("leave.end"), { exact: true }).fill("2026-10-25");
  await dialog.getByRole("textbox", { name: copy("leave.reason"), exact: true }).fill("出差期间保留到期复习");
  await dialog.getByRole("button", { name: copy("leave.preview"), exact: true }).press("Enter");
  await expect(dialog.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
  expectNoProblems(watch, "normal");
});

test("S07 自定考试地图未通过时仅锁定预测，沙盘提议与学习入口仍可用", async ({ page }) => {
  const fixture = fixtureOf("ds-final-custom");
  expect(fixture.forecast_available).toBe(false);
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { exam: "ds", view: "sandbox" }));
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: copy("sandbox.calculate"), exact: true }).press("Enter");
  await expect(dialog).toContainText(copy("sandbox.locked"));
  await expect(dialog.getByRole("link", { name: copy("sandbox.repair"), exact: true })).toHaveAttribute("href", "/map");
  await expect(dialog.locator(".ui-proposal")).toBeVisible();
  await expect(dialog.getByRole("button", { name: copy("sandbox.adopt"), exact: true })).toBeEnabled();
  await dialog.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("week-grid")).toBeVisible();
  await watch.open(urlOf(entry, { exam: "ds", view: "today" }));
  await expectLoaded(page, entry);
  await expect(page.locator("main#main").getByRole("heading", { name: copy("today.title"), exact: true })).toBeVisible();
  const start = button(page, "today.start");
  await expect(start).toBeEnabled();
  await start.press("Enter");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: copy("soon") })
      .first(),
  ).toBeVisible();
  expectNoProblems(watch, "normal");
});
