// S04 摸底诊断的冒烟测试（U04；照 S10 样板写）。
// 覆盖：两个视图都能用 ?view= 切换（开始页是引导页，测评中是沉浸页）；三档宽度的布局与原型一致（开始页三张方式卡手机竖排、平板与桌面一行；
// 测评页桌面右侧分模块进度、平板排在题目下面、手机收进“模块进度”抽屉；正文不横向溢出）；七态用 ?state= 强制显示、文案按 bk spec；
// 四个演示考试都能打开（自建考试的自适应诊断置灰、章节抽测标推荐）；主要按钮都能点：开始、提交（选“不会”可以不作答）、改用快速定位、
// 暂停并退出、接着做、上一步。按钮用键盘触发（locator.press）；文案与演示数据从仓库文件读，不在测试里抄一份。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

interface IndexJson {
  readonly exams: readonly { readonly key: string; readonly exam_id: string }[];
}
interface ModeJson {
  readonly mode: string;
  readonly available: boolean;
  readonly recommended: boolean;
}
interface PageJson {
  readonly min_pool_items: number;
  readonly modes: readonly ModeJson[];
  readonly bank: readonly unknown[];
}

const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S04.json");
const QUIZ = readJson("packages/ui/src/quiz/copy.zh-CN.json");
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

function rawFrom(source: unknown, file: string, path: string): string {
  let node: unknown = source;
  for (const key of path.split(".")) node = typeof node === "object" && node !== null ? (node as Record<string, unknown>)[key] : undefined;
  if (typeof node !== "string") throw new Error(`${file} 里没有文案 ${path}`);
  return node;
}

/** 本页文案，填好占位符。 */
function copy(path: string, values: Readonly<Record<string, string | number>> = {}): string {
  return rawFrom(COPY, "S04.json", path).replace(PLACEHOLDER, (whole: string, name: string) =>
    values[name] === undefined ? whole : String(values[name]),
  );
}

/** 带占位符的文案：占位符处匹配任意文字。 */
function pattern(path: string): RegExp {
  const escaped = rawFrom(COPY, "S04.json", path).replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  return new RegExp(escaped.replace(PLACEHOLDER, ".+"));
}

const entry = pageById("S04");
const EXAMS = (readJson("fixtures/exams/index.json") as IndexJson).exams;
const pageData = (examId: string): PageJson => readJson(`fixtures/pages/S04/${examId}.json`) as PageJson;
const KJ = pageData("junior-accounting");

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.first().boundingBox();
  if (box === null) throw new Error("元素没有显示出来，量不到位置");
  return box;
}

async function expectNoOverflow(page: Page): Promise<void> {
  const overflow = await page.locator("main#main").evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow, "正文区不应横向溢出").toBeLessThanOrEqual(1);
}

const modeOf = (page: Page) => page.locator("[data-mode]").first();
const title = (page: Page) => page.getByRole("heading", { level: 1, name: copy("header.title"), exact: true });

const WIDTHS = [
  { width: 375, height: 812, narrow: true, split: false },
  { width: 834, height: 900, narrow: false, split: false },
  { width: 1280, height: 900, narrow: false, split: true },
] as const;

test("S04 两个视图都能用 ?view= 切换：开始页是引导页，测评中是沉浸页", async ({ page }) => {
  expect(entry.views.map((view) => view.key)).toEqual(["start", "test"]);
  const watch = await watchPage(page);
  for (const view of entry.views) {
    await watch.open(urlOf(entry, { view: view.key }));
    await expectOpened(page, entry, view);
    await expectLoaded(page, entry);
    expectNoProblems(watch, "normal", `?view=${view.key}：`);
  }
  await expect(page.locator("header").getByRole("button", { name: copy("test.pause"), exact: true })).toBeVisible();
  await expect(page.locator("main#main").getByText(copy("confidence.unknown"), { exact: true })).toBeVisible();
});

for (const size of WIDTHS) {
  test(`S04 ${size.width} 宽：开始页方式卡${size.narrow ? "竖排" : "一行三张"}，正文不横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry, { view: "start" }));
    await expectLoaded(page, entry);
    await expect(title(page)).toBeVisible();
    const cards = page.locator("main#main fieldset label");
    const first = await boxOf(cards.nth(0));
    const second = await boxOf(cards.nth(1));
    if (size.narrow) expect(second.y, "手机上方式卡竖排").toBeGreaterThanOrEqual(first.y + first.height - 1);
    else expect(Math.abs(second.y - first.y), "平板与桌面上方式卡排在一行").toBeLessThanOrEqual(1);
    await expectNoOverflow(page);
    expectNoProblems(watch, "normal");
  });

  test(`S04 ${size.width} 宽：测评页${size.split ? "分模块进度在右栏" : size.narrow ? "分模块进度收进抽屉" : "分模块进度排在题目下面"}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry, { view: "test" }));
    await expectLoaded(page, entry);
    await expect(modeOf(page)).toHaveAttribute("data-mode", "immersive");
    if (size.narrow) {
      await expect(page.locator("main#main details summary").filter({ hasText: copy("modules.drawer") })).toBeVisible();
      await expect(page.locator("main#main .ui-cols__aside .ui-card")).toBeHidden();
    } else {
      const main = await boxOf(page.locator("main#main .ui-cols__main"));
      const aside = await boxOf(page.locator("main#main .ui-cols__aside .ui-card"));
      if (size.split) expect(aside.x, "分模块进度应在题目右边").toBeGreaterThanOrEqual(main.x + main.width - 1);
      else expect(aside.y, "分模块进度应排在题目下面").toBeGreaterThanOrEqual(main.y + main.height - 1);
    }
    await expectNoOverflow(page);
    expectNoProblems(watch, "normal");
  });
}

test("S04 七态都能用 ?state= 强制显示，文案按 bk spec", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    expectNoProblems(watch, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.title"));
      await expect(shown).toContainText(copy("state.empty.body", { n: KJ.min_pool_items }));
      await expect(shown.getByRole("button", { name: copy("state.empty.action"), exact: true })).toBeVisible();
      await expect(title(page), "空态时页头照常").toBeVisible();
    }
    if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
    if (state === "restricted") {
      await expect(shown).toContainText(copy("state.restricted.body"));
      await expect(title(page), "受限只落在规则卡里，其余照常").toBeVisible();
    }
    if (state === "insufficient_data") await expect(shown).toContainText(copy("state.insufficient.body"));
  }
});

test("S04 四个演示考试都能打开；自建考试的自适应诊断不可用，章节抽测标推荐", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    const data = pageData(exam.exam_id);
    await watch.open(urlOf(entry, { exam: exam.key, view: "start" }));
    await expectLoaded(page, entry);
    await expect(title(page), exam.key).toBeVisible();
    const radios = page.locator("main#main fieldset input[type=radio]");
    await expect(radios).toHaveCount(data.modes.length);
    for (const [index, mode] of data.modes.entries()) {
      if (mode.available) await expect(radios.nth(index), `${exam.key} ${mode.mode}`).toBeEnabled();
      else await expect(radios.nth(index), `${exam.key} ${mode.mode}`).toBeDisabled();
      if (mode.recommended) await expect(page.locator("main#main fieldset label").nth(index)).toContainText(pattern("mode.recommended"));
    }
    expectNoProblems(watch, "normal", `${exam.key}：`);
  }
});

test("S04 主要按钮都能点：开始、提交、改用快速定位、暂停并退出、接着做、上一步", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "start" }));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const bar = page.locator("header");
  await expect(main.getByRole("link", { name: copy("action.prev"), exact: true })).toHaveAttribute("href", "/setup");

  // 开始：换成测评中（沉浸页），从第 1 题起
  await main.getByRole("button", { name: copy("action.start"), exact: true }).press("Enter");
  await expect(modeOf(page)).toHaveAttribute("data-mode", "immersive");
  const total = KJ.bank.length;
  await expect(bar.getByText(copy("test.position", { n: 1, total }), { exact: true })).toBeVisible();

  // 选“不会”可以不作答就提交，题号往后走
  await main.getByText(copy("confidence.unknown"), { exact: true }).click();
  await main.getByRole("button", { name: rawFrom(QUIZ, "copy.zh-CN.json", "submit.action"), exact: true }).press("Enter");
  await expect(bar.getByText(copy("test.position", { n: 2, total }), { exact: true })).toBeVisible();

  // 改用快速定位：已答的题保留，换成按章自评
  await main.getByRole("button", { name: copy("test.switch_quick"), exact: true }).press("Enter");
  await expect(main.getByRole("heading", { name: copy("rating.title") })).toBeVisible();

  // 暂停并退出：回到开始页（引导页），提示接着做
  await bar.getByRole("button", { name: copy("test.pause"), exact: true }).press("Enter");
  await expect(modeOf(page)).toHaveAttribute("data-mode", "guided");
  const resume = main.getByRole("button", { name: copy("resume.action"), exact: true }).first();
  await expect(resume).toBeVisible();

  // 接着做：回到测评中
  await resume.press("Enter");
  await expect(modeOf(page)).toHaveAttribute("data-mode", "immersive");
  expectNoProblems(watch, "normal");
});
