import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const readJson = (path: string): unknown => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S20.json");
function copy(path: string): string {
  let value: unknown = COPY;
  for (const key of path.split("."))
    value = typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  if (typeof value !== "string") throw new Error(`缺少 S20 文案：${path}`);
  return value;
}
interface PageFixture {
  readonly exam_name: string;
  readonly submission: { readonly title: string; readonly original: string };
  readonly rubric: { readonly source: string; readonly consistent: boolean };
}
const fixture = (id: string) => readJson(`fixtures/pages/S20/${id}.json`) as PageFixture;
const EXAMS = (readJson("fixtures/exams/index.json") as { readonly exams: readonly { readonly key: string; readonly exam_id: string }[] })
  .exams;
const entry = pageById("S20");
async function box(locator: Locator) {
  const value = await locator.boundingBox();
  if (value === null) throw new Error("没有可见内容，无法量布局");
  return value;
}

for (const size of [
  { width: 375, height: 812, split: false },
  { width: 834, height: 900, split: false },
  { width: 1280, height: 900, split: true },
]) {
  test(`S20 ${size.width} 宽布局与正文无横溢`, async ({ page }) => {
    await page.setViewportSize(size);
    const watch = await watchPage(page);
    await watch.open(urlOf(entry));
    await expectOpened(page, entry, undefined);
    await expectLoaded(page, entry);
    const main = await box(page.locator("main#main .ui-cols__main"));
    const aside = await box(page.locator("main#main .ui-cols__aside"));
    if (size.split) expect(aside.x).toBeGreaterThanOrEqual(main.x + main.width - 1);
    else expect(aside.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
    const overflow = await page.locator("main#main").evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole("heading", { name: copy("annotation.title"), exact: true })).toBeVisible();
    expectNoProblems(watch, "normal");
    await page.screenshot({ path: join(ROOT, ".test-results/S20", `page-${size.width}.png`), fullPage: true });
    await page.locator("main#main").evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await page.screenshot({ path: join(ROOT, ".test-results/S20", `page-${size.width}-bottom.png`), fullPage: true });
  });
}

test("S20 主视图登记与四个演示考试", async ({ page }) => {
  expect(entry.views).toEqual([]);
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    const data = fixture(exam.exam_id);
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectOpened(page, entry, undefined);
    await expectLoaded(page, entry);
    const main = page.locator("main#main");
    await expect(main).toContainText(data.exam_name);
    await expect(main).toContainText(data.submission.title);
    await expect(main).toContainText(data.submission.original);
    await expect(main).toContainText(copy(`rubric.${data.rubric.source}`));
    if (!data.rubric.consistent) {
      await expect(main).toContainText(copy("score.inconsistent"));
      await expect(main.getByTestId("s20-score")).toHaveCount(0);
    }
    expectNoProblems(watch, "normal", exam.key);
  }
});

test("S20 七态保留中文提示，受限与不足局部降级", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    await expect(page.getByRole("heading", { level: 1, name: copy("title"), exact: true })).toBeVisible();
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.title"));
      await expect(shown).toContainText(copy("state.empty.body"));
      await expect(shown.getByRole("button", { name: copy("submit"), exact: true })).toBeVisible();
    }
    if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
    if (state === "restricted" || state === "insufficient_data") {
      await expect(shown).toContainText(copy(`state.${state}.body`));
      await expect(page.getByRole("heading", { name: copy("question.title"), exact: true })).toBeVisible();
      await expect(page.getByTestId("s20-score")).toHaveCount(0);
    }
    if (state === "restricted") {
      await shown.getByRole("button", { name: copy("state.restricted.action"), exact: true }).press("Enter");
      await expect(page.locator("main#main").getByRole("radio", { name: copy("method.self"), exact: true })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expect(page.locator("main#main")).toContainText(copy("score.self"));
      await expect(page.getByTestId("s20-score")).toHaveCount(0);
    }
    expectNoProblems(watch, state);
  }
});

test("S20 提交弹窗包含七题型三种输入，草稿保留，未接能力提示", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const open = page
    .locator("main#main")
    .getByRole("button", { name: copy("submit"), exact: true })
    .first();
  await open.press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("draft.title"), exact: true });
  await expect(dialog).toBeVisible();
  const kind = dialog.getByRole("combobox", { name: copy("question.type") });
  for (const type of ["short_answer", "essay", "case", "composition", "translation", "calculation", "algorithm_proof"]) {
    await expect(kind.locator(`option[value="${type}"]`)).toHaveText(copy(`types.${type}`));
    await kind.selectOption(type);
    await expect(kind).toHaveValue(type);
  }
  await dialog.getByRole("textbox", { name: copy("draft.question"), exact: true }).fill("示例练习题目");
  await dialog.getByRole("textbox", { name: copy("draft.answer"), exact: true }).fill("这是我自己写的练习答案。");
  await dialog.getByRole("radio", { name: copy("draft.photo"), exact: true }).press("Enter");
  await expect(dialog.getByLabel(copy("draft.file"), { exact: true })).toBeVisible();
  await expect(dialog).toContainText(copy("draft.photoHint"));
  await dialog.getByRole("radio", { name: copy("draft.voice"), exact: true }).press("Enter");
  await dialog.getByRole("button", { name: copy("draft.record"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
  await dialog.getByRole("radio", { name: copy("draft.keyboard"), exact: true }).press("Enter");
  await expect(dialog.getByRole("textbox", { name: copy("draft.answer"), exact: true })).toHaveValue("这是我自己写的练习答案。");
  await dialog.getByRole("button", { name: copy("draft.action"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: copy("draft.cancel"), exact: true }).press("Enter");
  await expect(dialog).toBeHidden();
  await open.press("Enter");
  await expect(dialog.getByRole("textbox", { name: copy("draft.answer"), exact: true })).toHaveValue("这是我自己写的练习答案。");
  await page.screenshot({ path: join(ROOT, ".test-results/S20", "answer-dialog.png"), fullPage: true });
  await dialog.press("Escape");
  for (const input of ["keyboard", "photo", "voice"]) {
    await page
      .locator("main#main")
      .getByRole("button", { name: copy(`draft.${input}`), exact: true })
      .press("Enter");
    await expect(dialog.getByRole("radio", { name: copy(`draft.${input}`), exact: true })).toHaveAttribute("aria-checked", "true");
    await dialog.press("Escape");
  }
  expectNoProblems(watch, "normal");
});

test("S20 三评分方式、入口链接与机构简版提示", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  for (const method of ["self", "none", "mentor"]) {
    const choice = main.getByRole("radio", { name: copy(`method.${method}`), exact: true });
    await choice.press("Enter");
    await expect(choice).toHaveAttribute("aria-checked", "true");
    await expect(main).toContainText(copy(`method.${method}Hint`));
    if (method === "mentor") await expect(main.getByTestId("s20-score")).toBeVisible();
    else {
      await expect(main.getByTestId("s20-score")).toHaveCount(0);
      await expect(main).toContainText(copy(`score.${method}`));
    }
  }
  await expect(main).toContainText(copy("method.pending"));
  await expect(main.getByRole("link", { name: copy("next.practice"), exact: true })).toHaveAttribute("href", "/quiz/demo");
  await main.getByRole("button", { name: copy("expressions"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
  await main.getByRole("tab", { name: copy("tabs.institution"), exact: true }).press("Enter");
  await expect(main).toContainText(copy("institution.title"));
  await expect(main.getByTestId("s20-score")).toHaveCount(0);
  await main.getByRole("tab", { name: copy("tabs.mine"), exact: true }).press("Enter");
  await expect(main.getByTestId("s20-score")).toBeVisible();
  expectNoProblems(watch, "normal");
});

test("S20 离线仍能键入草稿且明确本页保留边界", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { state: "offline" }));
  await expectState(page, entry, "offline");
  await page
    .locator("main#main")
    .getByRole("button", { name: copy("submit"), exact: true })
    .first()
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("draft.title"), exact: true });
  await dialog.getByRole("textbox", { name: copy("draft.answer"), exact: true }).fill("离线草稿");
  await expect(dialog).toContainText(copy("draft.offline"));
  expectNoProblems(watch, "offline");
});
