// S17 本页冒烟：三视图、七态、三档宽度与主要入口。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { pathTo } from "../../../apps/learner/src/routes.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const COPY = JSON.parse(readFileSync(join(ROOT, "apps/learner/src/i18n/zh-CN/S17.json"), "utf8")) as Record<string, unknown>;
function copy(path: string): string {
  let value: unknown = COPY;
  for (const key of path.split("."))
    value = typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  if (typeof value !== "string") throw new Error(`S17.json 缺文案 ${path}`);
  return value;
}
const entry = pageById("S17");
const VIEWS = ["recommend", "banks", "records"] as const;
const WIDTHS = [
  { width: 375, height: 812 },
  { width: 834, height: 900 },
  { width: 1280, height: 900 },
] as const;

for (const size of WIDTHS) {
  test(`S17 ${size.width} 宽：推荐、题库与试卷、记录均可打开且无正文横向溢出`, async ({ page }) => {
    await page.setViewportSize(size);
    const watch = await watchPage(page);
    for (const view of VIEWS) {
      await watch.open(urlOf(entry, { view }));
      await expectOpened(page, entry, undefined);
      await expectLoaded(page, entry);
      const main = page.locator("main#main");
      await expect(main.getByRole("heading", { level: 1, name: copy("title"), exact: true })).toBeVisible();
      await expect(main.getByRole("tab", { name: copy(`tabs.${view}`), exact: true })).toHaveAttribute("aria-selected", "true");
      const title = view === "recommend" ? "recommend.smart" : view === "banks" ? "banks.title" : "records.title";
      await expect(main.getByRole("heading", { name: copy(title), exact: true })).toBeVisible();
      expect(await main.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      expectNoProblems(watch, "normal", view);
    }
  });
}

test("S17 七态均可强制显示，受限和数据不足保留核心练习", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.title"));
      await expect(shown).toContainText(copy("state.empty.body"));
      await expect(shown.getByRole("button", { name: copy("state.empty.action"), exact: true })).toBeVisible();
    }
    if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
    if (state === "restricted" || state === "insufficient_data") {
      await expect(shown).toContainText(copy(`state.${state}.body`));
      await expect(
        page
          .locator("main#main")
          .getByRole("link", { name: copy("practice"), exact: true })
          .first(),
      ).toBeVisible();
    }
    expectNoProblems(watch, state);
  }
});

test("S17 四个演示考试均显示本考试的题库和推荐", async ({ page }) => {
  const watch = await watchPage(page);
  const index = JSON.parse(readFileSync(join(ROOT, "fixtures/exams/index.json"), "utf8")) as {
    exams: { key: string; exam_id: string }[];
  };
  for (const exam of index.exams) {
    const fixture = JSON.parse(readFileSync(join(ROOT, `fixtures/pages/S17/${exam.exam_id}.json`), "utf8")) as {
      recommendation: { title: string; point_id: string };
      banks: { title: string }[];
    };
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectLoaded(page, entry);
    await expect(page.locator("main#main")).toContainText(fixture.recommendation.title);
    await expect(page.locator("main#main").getByRole("link", { name: copy("recommend.chapter"), exact: true })).toHaveAttribute(
      "href",
      pathTo("S10", { kpId: fixture.recommendation.point_id }),
    );
    await watch.open(urlOf(entry, { exam: exam.key, view: "banks" }));
    await expectLoaded(page, entry);
    for (const bank of fixture.banks) await expect(page.locator("main#main")).toContainText(bank.title);
    expectNoProblems(watch, "normal", exam.key);
  }
});

test("S17 主要按钮可操作：添加、设置、组卷、卷面与记录续做", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const clickButton = async (name: string) => main.getByRole("button", { name, exact: true }).first().click();
  const closeDialog = async () =>
    page
      .getByRole("dialog")
      .getByRole("button", { name: copy("cancel"), exact: true })
      .click();
  await clickButton(copy("add"));
  await page
    .getByRole("button", { name: copy("newQuestion"), exact: true })
    .last()
    .click();
  const editor = page.getByRole("dialog", { name: copy("dialog.newQuestion.title"), exact: true });
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel(copy("form.type"), { exact: true })).toBeVisible();
  await expect(editor.getByLabel(copy("form.stem"), { exact: true })).toBeVisible();
  await closeDialog();

  await clickButton(copy("settings"));
  await expect(page.getByRole("dialog", { name: copy("dialog.settings.title"), exact: true })).toBeVisible();
  await closeDialog();

  await main.getByRole("tab", { name: copy("tabs.banks"), exact: true }).click();
  await expect(main.getByRole("heading", { name: copy("banks.title"), exact: true })).toBeVisible();
  await expect(main.getByLabel(copy("banks.tag"), { exact: true })).toBeVisible();
  await expect(main.getByLabel(copy("banks.sort"), { exact: true })).toBeVisible();
  await clickButton(copy("banks.auto"));
  const auto = page.getByRole("dialog", { name: copy("dialog.auto.title"), exact: true });
  await expect(auto).toBeVisible();
  const steps = (COPY["form"] as { steps: string[] }).steps;
  for (let step = 0; step < steps.length; step += 1) {
    await expect(auto.getByRole("radio", { name: steps[step] ?? "", exact: true })).toHaveAttribute("aria-checked", "true");
    if (step < steps.length - 1) await auto.getByRole("button", { name: copy("form.next"), exact: true }).click();
  }
  await expect(auto.getByRole("button", { name: copy("form.create"), exact: true })).toBeVisible();
  await closeDialog();

  await clickButton(copy("banks.manual"));
  const manual = page.getByRole("dialog", { name: copy("dialog.manual.title"), exact: true });
  await expect(manual).toBeVisible();
  await manual.getByRole("button", { name: copy("form.print"), exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
  await closeDialog();

  await main.getByRole("radio", { name: copy("banks.paper"), exact: true }).click();
  await expect(main.getByRole("heading", { name: copy("banks.section"), exact: true })).toBeVisible();
  await main.getByRole("tab", { name: copy("tabs.records"), exact: true }).click();
  await expect(main.getByRole("link", { name: copy("records.resume"), exact: true }).first()).toHaveAttribute("href", /\/quiz\//);
  await expect(main.getByRole("link", { name: copy("records.review"), exact: true }).first()).toHaveAttribute("href", /\/quiz\//);
  expectNoProblems(watch, "normal");
});

test("S17 窄屏真题、限时、拍照、导入和导师入口可预览", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const close = async () =>
    page
      .getByRole("dialog")
      .getByRole("button", { name: copy("cancel"), exact: true })
      .click();
  await main.getByRole("button", { name: copy("recommend.pastAction"), exact: true }).click();
  const past = page.getByRole("dialog", { name: copy("dialog.past.title"), exact: true });
  await expect(past.getByLabel(copy("form.year"), { exact: true })).toBeVisible();
  await expect(past.getByLabel(copy("form.region"), { exact: true })).toBeVisible();
  await expect(past.getByLabel(copy("form.paperSource"), { exact: true })).toContainText(copy("form.memory"));
  await expect(past.getByRole("link", { name: copy("form.mockCenter"), exact: true })).toHaveAttribute("href", pathTo("S22"));
  await close();
  await main.getByRole("button", { name: copy("recommend.specialAction"), exact: true }).click();
  const special = page.getByRole("dialog", { name: copy("dialog.special.title"), exact: true });
  await expect(special.getByLabel(copy("form.perQuestion"), { exact: true })).toBeVisible();
  await close();
  for (const kind of ["photo", "import", "tutor"]) {
    await main.getByRole("button", { name: copy("add"), exact: true }).click();
    await main.getByRole("button", { name: copy(kind), exact: true }).click();
    const dialog = page.getByRole("dialog", { name: copy("dialog." + kind + ".title"), exact: true });
    await expect(dialog).toBeVisible();
    if (kind === "photo") await expect(dialog.getByLabel(copy("form.intent"), { exact: true })).toBeVisible();
    if (kind === "import") await expect(dialog.getByLabel(copy("form.chooseFile"), { exact: true })).toBeVisible();
    if (kind === "tutor") {
      await expect(dialog.getByLabel(copy("form.mode"), { exact: true })).toHaveValue(copy("form.blind"));
      await expect(dialog).toContainText(copy("notice.aiBadge"));
    }
    expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await close();
  }
  expectNoProblems(watch, "normal");
});

test("S17 题库和记录视图的局部受限或缺题仍保留正文", async ({ page }) => {
  const watch = await watchPage(page);
  for (const view of ["banks", "records"] as const) {
    for (const state of ["restricted", "insufficient_data"] as const) {
      await watch.open(urlOf(entry, { view, state }));
      await expectState(page, entry, state);
      await expect(page.locator("main#main").getByRole("tab", { name: copy("tabs." + view), exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(
        page.locator("main#main").getByRole("heading", { name: copy(view === "banks" ? "banks.title" : "records.title"), exact: true }),
      ).toBeVisible();
      expectNoProblems(watch, state);
    }
  }
});
