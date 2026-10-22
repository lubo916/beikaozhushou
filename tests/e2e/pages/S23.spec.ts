// S23 测评报告的冒烟测试：三档布局、七态、四个演示考试与主要操作。
// 文案从本页 i18n 读取；布局断言只比较相对位置，不依赖截图的像素细节。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { formatCount, formatScore } from "../../../packages/shared/src/format/index.ts";
import { pathTo } from "../../../apps/learner/src/routes.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const ENTRY = pageById("S23");
interface ReportFixture {
  readonly title: string;
  readonly summary: { readonly score: number; readonly total: number; readonly minimum_sample_count: number };
  readonly losses: readonly { readonly name: string; readonly question_ids: readonly string[] }[];
  readonly questions: readonly { readonly id: string; readonly number: number; readonly title: string; readonly analysis: string }[];
  readonly reinforcement: { readonly proposal: { readonly what: string } };
}
function fixture(examId: string): ReportFixture {
  return JSON.parse(readFileSync(join(ROOT, `fixtures/pages/S23/${examId}.json`), "utf8")) as ReportFixture;
}
const KJ = fixture("junior-accounting");
const UI = JSON.parse(readFileSync(join(ROOT, "packages/ui/src/copy.zh-CN.json"), "utf8")) as {
  readonly action: { readonly confirm: string; readonly decline: string };
};
const COPY = JSON.parse(readFileSync(join(ROOT, "apps/learner/src/i18n/zh-CN/S23.json"), "utf8")) as unknown;
const EXAMS = (
  JSON.parse(readFileSync(join(ROOT, "fixtures/exams/index.json"), "utf8")) as {
    readonly exams: readonly { readonly key: string; readonly exam_id: string }[];
  }
).exams;

function copy(path: string, values: Readonly<Record<string, string | number>> = {}): string {
  let value: unknown = COPY;
  for (const key of path.split("."))
    value = typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  if (typeof value !== "string") throw new Error(`S23.json 里没有文案 ${path}`);
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole: string, name: string) =>
    values[name] === undefined ? whole : String(values[name]),
  );
}

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.first().boundingBox();
  if (box === null) throw new Error("元素没有显示出来，量不到位置");
  return box;
}

const WIDTHS = [
  { width: 375, height: 812, split: false },
  { width: 834, height: 900, split: false },
  { width: 1280, height: 900, split: true },
] as const;

for (const size of WIDTHS) {
  test(`S23 ${size.width} 宽：${size.split ? "左右两栏" : "上下单栏"}，正文不横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const watch = await watchPage(page);
    await watch.open(urlOf(ENTRY));
    await expectOpened(page, ENTRY, undefined);
    await expectLoaded(page, ENTRY);
    const main = await boxOf(page.locator("main#main .ui-cols__main"));
    const aside = await boxOf(page.locator("main#main .ui-cols__aside"));
    if (size.split) expect(aside.x).toBeGreaterThanOrEqual(main.x + main.width - 1);
    else expect(aside.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
    const overflow = await page.locator("main#main").evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow, "正文区不应横向溢出").toBeLessThanOrEqual(1);
    await page.screenshot({ path: join(ROOT, ".bk/qa/S23", `default@${size.width}.png`), fullPage: true });
    expectNoProblems(watch, "normal");
  });
}

test("S23 页面登记为单一主视图", () => {
  expect(ENTRY.views).toEqual([]);
});

test("S23 七态都能通过接口层强制显示", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(ENTRY, { state }));
    await expectState(page, ENTRY, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.title"));
      await expect(shown).toContainText(copy("state.empty.body"));
      await expect(shown.getByRole("link", { name: copy("state.empty.action") })).toHaveAttribute("href", pathTo("S22"));
    }
    if (state === "error") await expect(shown).toContainText(copy("state.error.body"));
    if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
    if (state === "restricted") {
      await expect(shown).toContainText(copy("state.restricted.title"));
      await expect(page.locator("main#main")).toContainText(KJ.title);
    }
    if (state === "insufficient_data") {
      await expect(shown).toContainText(copy("state.insufficient_data.title"));
      await expect(shown).toContainText(copy("state.insufficient_data.body", { minimum: formatCount(KJ.summary.minimum_sample_count) }));
      await expect(page.locator("main#main")).toContainText(formatScore(KJ.summary.score, { total: KJ.summary.total }));
    }
    expectNoProblems(watch, state);
  }
});

test("S23 四个演示考试都能打开各自报告", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    await watch.open(urlOf(ENTRY, { exam: exam.key }));
    await expectLoaded(page, ENTRY);
    const report = fixture(exam.exam_id);
    await expect(page.locator("main#main")).toContainText(copy("sample"));
    await expect(page.locator("main#main")).toContainText(report.title);
    await expect(page.locator("main#main")).toContainText(formatScore(report.summary.score, { total: report.summary.total }));
    expectNoProblems(watch, "normal", `${exam.key}：`);
  }
});

async function expectSoon(page: Page, target: Locator): Promise<void> {
  await target.press("Enter");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: copy("soon") })
      .first(),
  ).toBeVisible();
}

test("S23 逐题复盘展示原作答和解析，图例只打开对应题目", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(ENTRY));
  await expectLoaded(page, ENTRY);
  const main = page.locator("main#main");
  await main.getByRole("button", { name: copy("header.review"), exact: true }).press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("review.title"), exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(copy("review.filtered", { filter: copy("review.all") }));
  const question = KJ.questions[0];
  if (question === undefined) throw new Error("示范报告需要至少一道可复盘的题目");
  await expect(dialog).toContainText(question.title);
  await expect(dialog).toContainText(question.analysis);
  await expect(dialog).toContainText(copy("review.answer"));
  await expect(dialog).toContainText(copy("review.confidence"));
  await expectSoon(page, dialog.getByRole("button", { name: copy("review.open"), exact: true }).first());
  await dialog.getByRole("button", { name: copy("review.close"), exact: true }).press("Enter");
  await expect(dialog).toBeHidden();

  const loss = KJ.losses[0];
  if (loss === undefined) throw new Error("示范报告需要至少一种失分归因");
  await main.getByRole("button", { name: copy("loss.legend", { name: loss.name }), exact: true }).press("Enter");
  await expect(dialog).toContainText(copy("review.filtered", { filter: loss.name }));
  await expect(dialog.getByRole("heading", { level: 3 })).toHaveCount(loss.question_ids.length);
  for (const row of KJ.questions.filter((item) => loss.question_ids.includes(item.id))) await expect(dialog).toContainText(row.title);
  await dialog.getByRole("button", { name: copy("review.close"), exact: true }).press("Enter");

  await main.getByRole("button", { name: copy("loss.attribute"), exact: true }).press("Enter");
  await expect(dialog).toContainText(copy("review.filtered", { filter: copy("review.unattributed") }));
  await expectSoon(page, dialog.getByRole("button", { name: copy("review.attribute"), exact: true }).first());
  await dialog.getByRole("button", { name: copy("review.close"), exact: true }).press("Enter");
  expectNoProblems(watch, "normal");
});

test("S23 补强清单先给待确认提议，模拟与重做按钮有明确反馈", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(ENTRY));
  await expectLoaded(page, ENTRY);
  const main = page.locator("main#main");
  await expectSoon(page, main.getByRole("button", { name: copy("header.redo"), exact: true }));
  await expectSoon(page, main.getByRole("button", { name: copy("simulation.try"), exact: true }));
  await main.getByRole("button", { name: copy("plan.propose"), exact: true }).press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("plan.dialog"), exact: true });
  await expect(dialog).toContainText(copy("plan.note"));
  await expect(dialog).toContainText(KJ.reinforcement.proposal.what);
  await expectSoon(page, dialog.getByRole("button", { name: UI.action.confirm, exact: true }));
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: copy("plan.plan"), exact: true })).toHaveAttribute("href", pathTo("S07"));
  await dialog.getByRole("button", { name: UI.action.decline, exact: true }).press("Enter");
  await expect(dialog).toBeHidden();
  await expect(main.getByRole("link", { name: copy("plan.today"), exact: true })).toHaveAttribute("href", pathTo("S06"));
  await expect(main.getByRole("link", { name: copy("header.back"), exact: true })).toHaveAttribute("href", pathTo("S22"));
  expectNoProblems(watch, "normal");
});

test("S23 主观题未评分时保留报告，评分入口可打开待评分题", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(ENTRY, { state: "restricted" }));
  await expectState(page, ENTRY, "restricted");
  await page
    .locator("main#main")
    .getByRole("button", { name: copy("state.restricted.action"), exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("review.title"), exact: true });
  await expect(dialog).toContainText(copy("review.filtered", { filter: copy("review.pending") }));
  await expectSoon(page, dialog.getByRole("button", { name: copy("review.grade"), exact: true }).first());
  await dialog.getByRole("button", { name: copy("review.close"), exact: true }).press("Enter");
  expectNoProblems(watch, "restricted");
});

test("S23 离线可读已生成报告，其他考试不会串用缓存", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(ENTRY, { exam: "kj" }));
  await expectLoaded(page, ENTRY);
  await expect(page.locator("main#main")).toContainText(KJ.title);
  await watch.open(urlOf(ENTRY, { exam: "kj", state: "offline" }));
  await expectState(page, ENTRY, "offline");
  const main = page.locator("main#main");
  await expect(main).toContainText(KJ.title);
  await expect(main).toContainText(formatScore(KJ.summary.score, { total: KJ.summary.total }));
  expectNoProblems(watch, "offline");
  await watch.open(urlOf(ENTRY, { exam: "en", state: "offline" }));
  await expectState(page, ENTRY, "offline");
  await expect(main).toContainText(copy("state.offline.missing"));
  await expect(main).not.toContainText(KJ.title);
  expectNoProblems(watch, "offline");
});

test("S23 工具条同页切考试后，缓存仍按实际考试隔离", async ({ page }) => {
  const devCopy = JSON.parse(readFileSync(join(ROOT, "apps/learner/src/mocks/devtools/copy.zh-CN.json"), "utf8")) as { toggle: string };
  await page.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => false }));
  const watch = await watchPage(page);
  await watch.open(urlOf(ENTRY, { exam: "kj" }));
  await expectLoaded(page, ENTRY);
  await page.getByRole("button", { name: devCopy.toggle, exact: true }).press("Enter");
  await page.getByRole("radio", { name: /^en / }).press("Enter");
  const en = fixture("cet-6");
  await expect(page.locator("main#main")).toContainText(en.title);
  await expect(page).toHaveURL(/exam=kj/);
  await watch.open(urlOf(ENTRY, { exam: "kj", state: "offline" }));
  await expectState(page, ENTRY, "offline");
  await expect(page.locator("main#main")).toContainText(KJ.title);
  await expect(page.locator("main#main")).not.toContainText(en.title);
  await watch.open(urlOf(ENTRY, { exam: "en", state: "offline" }));
  await expectState(page, ENTRY, "offline");
  await expect(page.locator("main#main")).toContainText(en.title);
  expectNoProblems(watch, "offline");
});
