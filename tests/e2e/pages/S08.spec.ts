// S08 复盘与报告：三档布局、三个周期、七态、四个演示考试，以及唯一计划决定点的冒烟测试。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const readJson = (path: string): unknown => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S08.json");
const UI_COPY = readJson("packages/ui/src/copy.zh-CN.json");

function textAt(source: unknown, path: string): string {
  let value = source;
  for (const key of path.split("."))
    value = typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  if (typeof value !== "string") throw new Error(`S08 测试找不到文案 ${path}`);
  return value;
}
const copy = (path: string): string => textAt(COPY, path);
const uiCopy = (path: string): string => textAt(UI_COPY, path);

interface ExamIndex {
  readonly exams: readonly { readonly key: string; readonly exam_id: string }[];
}
interface ReportFixture {
  readonly views: { readonly week: { readonly exam_name: string } };
}
const EXAMS = (readJson("fixtures/exams/index.json") as ExamIndex).exams;
const entry = pageById("S08");
const VIEWS = ["week", "month", "round"] as const;
const WIDTHS = [
  { width: 375, height: 812, split: false },
  { width: 834, height: 900, split: false },
  { width: 1280, height: 900, split: true },
] as const;

async function boxOf(
  locator: Locator,
): Promise<{ readonly x: number; readonly y: number; readonly width: number; readonly height: number }> {
  const box = await locator.first().boundingBox();
  if (box === null) throw new Error("报告卡片未显示，无法核对布局");
  return box;
}

for (const size of WIDTHS) {
  test(`S08 ${size.width} 宽：${size.split ? "左右两栏" : "上下单栏"}，正文不横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry));
    await expectOpened(page, entry, undefined);
    await expectLoaded(page, entry);
    const main = page.locator("main#main");
    await expect(main.getByRole("heading", { level: 1, name: copy("title"), exact: true })).toBeVisible();
    const left = await boxOf(main.locator(".ui-cols__main"));
    const right = await boxOf(main.locator(".ui-cols__aside"));
    if (size.split) expect(right.x, "桌面右栏在数据主栏右边").toBeGreaterThanOrEqual(left.x + left.width - 1);
    else expect(right.y, "手机和平板右栏排到主栏下方").toBeGreaterThanOrEqual(left.y + left.height - 1);
    const overflow = await main.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow, "正文不应横向溢出").toBeLessThanOrEqual(1);
    expectNoProblems(watch, "normal");
    // 外壳正文独立滚动；截图时展开滚动容器，避免整页图片下方只留下空白。
    await main.evaluate((element) => {
      element.style.height = "auto";
      element.style.overflow = "visible";
      const shell = element.closest<HTMLElement>("[data-mode]");
      if (shell !== null) shell.style.height = "auto";
    });
    await page.screenshot({ path: `.test-results/S08-${size.width}.png`, fullPage: true });
  });
}

test("S08 三个周期均能用 ?view= 打开，轮次显示与上一轮对比", async ({ page }) => {
  const watch = await watchPage(page);
  for (const view of VIEWS) {
    await watch.open(urlOf(entry, { view }));
    await expectLoaded(page, entry);
    const main = page.locator("main#main");
    await expect(main.getByRole("tab", { name: copy(`views.${view}`), exact: true })).toHaveAttribute("aria-selected", "true");
    for (const section of ["summary", "mastery", "methods", "rhythm", "sources", "mistakes", "coach", "questions", "feedback"]) {
      await expect(main.getByRole("heading", { name: copy(`sections.${section}`), exact: true })).toBeVisible();
    }
    const decisionTitle = view === "week" ? copy("sections.decision") : copy("decision.next_period");
    await expect(main.getByRole("heading", { name: decisionTitle, exact: true })).toBeVisible();
    const comparison = main.getByRole("heading", { name: copy("sections.comparison"), exact: true });
    if (view === "round") await expect(comparison).toBeVisible();
    else await expect(comparison).toHaveCount(0);
    expectNoProblems(watch, "normal");
  }
});

test("S08 点击周期标签切换报告并更新地址", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  for (const view of ["month", "round", "week"] as const) {
    const tab = main.getByRole("tab", { name: copy(`views.${view}`), exact: true });
    await tab.press("Enter");
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(new RegExp(`[?&]view=${view}(?:&|$)`));
    await expectLoaded(page, entry);
  }
  expectNoProblems(watch, "normal");
});

test("S08 七态可强制显示，受限和数据不足保留原始数据", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    const main = page.locator("main#main");
    if (state === "empty") {
      await expect(main.getByRole("heading", { level: 1, name: copy("title"), exact: true })).toBeVisible();
      await expect(main.locator(".ui-state--empty").getByRole("link")).toHaveAttribute("href", pageById("S06").path);
    }
    if (state === "restricted" || state === "insufficient_data") {
      await expect(main.getByRole("heading", { name: copy("sections.summary"), exact: true })).toBeVisible();
      await expect(main.getByRole("heading", { name: copy("sections.methods"), exact: true })).toBeVisible();
      if (state === "insufficient_data") {
        await expect(main).toContainText(copy("raw_only"));
        await expect(main.locator('input[name="s08-change"]')).toHaveCount(0);
      }
    }
    expectNoProblems(watch, state);
  }
});

test("S08 四个演示考试均显示对应考试的报告", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    const fixture = readJson(`fixtures/pages/S08/${exam.exam_id}.json`) as ReportFixture;
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectLoaded(page, entry);
    const main = page.locator("main#main");
    await expect(main).toContainText(fixture.views.week.exam_name);
    await expect(main.getByRole("heading", { name: copy("sections.mastery"), exact: true })).toBeVisible();
    expectNoProblems(watch, "normal", `${exam.key}：`);
  }
});

test("S08 只改一件事无默认：自己写一条先成为提议，确认后才提示后续接入", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const choice = main.locator('input[name="s08-change"]');
  expect(await choice.count(), "应提供导师建议和自定义等单选项").toBeGreaterThan(1);
  await expect(main.locator('input[name="s08-change"]:checked')).toHaveCount(0);
  const confirm = main.getByRole("button", { name: copy("decision.confirm"), exact: true });
  await expect(confirm).toBeDisabled();
  await main.locator('input[name="s08-change"][value="own"]').check();
  await expect(confirm).toBeDisabled();
  await main.getByRole("textbox", { name: copy("decision.own_label"), exact: true }).fill("学完一节后，先合上资料回忆要点。");
  await confirm.press("Enter");
  const proposal = main.locator(".ui-proposal");
  await expect(proposal).toBeVisible();
  await expect(proposal).toContainText("学完一节后，先合上资料回忆要点。");
  await expect(proposal.getByRole("button", { name: uiCopy("action.decline"), exact: true })).toBeVisible();
  await proposal.getByRole("button", { name: uiCopy("action.confirm"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("plan_soon") })).toBeVisible();
  expectNoProblems(watch, "normal");
});

test("S08 复盘问题可以填写，保存与报告反馈给出明确回应", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  await main.getByRole("textbox", { name: copy("questions.effective"), exact: true }).fill("变式练习后的主动回忆最有效。");
  await main.getByRole("textbox", { name: copy("questions.waste"), exact: true }).fill("反复看已经会的内容。");
  await main.getByRole("button", { name: copy("questions.save"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("save_soon") })).toBeVisible();
  await main.getByRole("button", { name: copy("feedback.yes"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("feedback_soon") })).toBeVisible();
  expectNoProblems(watch, "normal");
});

test("S08 报告不准也可一键反馈", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  await page
    .locator("main#main")
    .getByRole("button", { name: copy("feedback.no"), exact: true })
    .press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("feedback_soon") })).toBeVisible();
  expectNoProblems(watch, "normal");
});

test("S08 已加载报告后浏览器断网：保留报告并禁用全部写入入口", async ({ page, context }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const report = main.locator('[data-testid="s08-data"]');
  const before = await report.textContent();
  expect(before).toContain(copy("metrics.effective_minutes"));
  const radios = main.locator('input[name="s08-change"]');
  expect(await radios.count()).toBeGreaterThan(1);
  await radios.first().check();
  const proposalButton = main.getByRole("button", { name: copy("decision.confirm"), exact: true });
  await expect(proposalButton).toBeEnabled();
  try {
    await context.setOffline(true);
    await expect(report).toBeVisible();
    await expect(report).toHaveText(before ?? "");
    await expect(main).toContainText(copy("decision.offline"));
    for (const radio of await radios.all()) await expect(radio).toBeDisabled();
    for (const key of ["decision.confirm", "questions.save", "feedback.yes", "feedback.no"]) {
      await expect(main.getByRole("button", { name: copy(key), exact: true })).toBeDisabled();
    }
    expectNoProblems(watch, "offline");
  } finally {
    await context.setOffline(false);
  }
});
