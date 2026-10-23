// S15：两视图、三档宽度、七态、四考试与主要交互。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const readJson = (path: string): unknown => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S15.json");
const EXAMS = (readJson("fixtures/exams/index.json") as { exams: readonly { key: string; exam_id: string }[] }).exams;
const entry = pageById("S15");
function copy(path: string): string {
  let value: unknown = COPY;
  for (const key of path.split("."))
    value = typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  if (typeof value !== "string") throw new Error(`S15.json 缺少文案 ${path}`);
  return value;
}
const widths = [375, 834, 1280] as const;

for (const width of widths) {
  for (const view of entry.views) {
    test(`S15 ${width} 宽：${view.key} 能打开且正文不溢出`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const watch = await watchPage(page);
      await watch.open(urlOf(entry, { view: view.key }));
      await expectOpened(page, entry, view);
      await expectLoaded(page, entry);
      const main = page.locator("main#main");
      if (view.key === "home") await expect(main.getByRole("heading", { name: copy("queue.title"), exact: true })).toBeVisible();
      else {
        await expect(main.getByRole("button", { name: copy("session.flip"), exact: true })).toBeVisible();
        await expect(main.getByRole("button", { name: copy("session.again"), exact: true })).toHaveCount(0);
        const face = main.locator(".s15-cardface");
        const minimum = await face.evaluate(
          (element) => Number.parseFloat(getComputedStyle(element).getPropertyValue("--size-space-8")) * 8,
        );
        expect((await face.boundingBox())?.height, "卡面应保持可点按的高度").toBeGreaterThanOrEqual(minimum);
      }
      expect(await main.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `.test-results/S15-${width}-${view.key}.png`, fullPage: true });
      if (view.key === "session") {
        await main.getByRole("button", { name: copy("session.flip"), exact: true }).press("Enter");
        for (const key of ["again", "hard", "good", "easy"]) {
          const rating = main.getByRole("button", { name: copy(`session.${key}`), exact: true });
          await expect(rating).toBeVisible();
          await expect(rating).toBeEnabled();
        }
        await page.screenshot({ path: `.test-results/S15-${width}-answer.png`, fullPage: true });
      }
      expectNoProblems(watch, "normal");
    });
  }
}

for (const view of entry.views) {
  test(`S15 ${view.key}：七态均可用参数强制显示`, async ({ page }) => {
    const watch = await watchPage(page);
    for (const state of ABNORMAL_STATES) {
      await watch.open(urlOf(entry, { view: view.key, state }));
      await expectState(page, entry, state);
      const shown = page.locator(`main#main .ui-state--${state}`).first();
      if (state === "empty") {
        await expect(shown).toContainText(copy("state.empty.title"));
        await expect(shown.getByRole("link", { name: copy("state.empty.action"), exact: true })).toHaveAttribute("href", "/today");
      }
      if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
      if (state === "restricted") {
        await expect(shown).toContainText(copy("state.restricted.title"));
        await expect(page.locator("main#main")).toContainText(view.key === "home" ? copy("queue.title") : copy("session.title"));
      }
      if (state === "insufficient_data") await expect(shown).toContainText(copy("state.insufficient_data.title"));
      expectNoProblems(watch, state);
    }
  });
}

test("S15 四个演示考试都有本考试的回忆卡与队列", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    const data = readJson(`fixtures/pages/S15/${exam.exam_id}.json`) as { exam_name: string; session: { card: { front: string } } };
    await watch.open(urlOf(entry, { exam: exam.key, view: "home" }));
    await expectLoaded(page, entry);
    await expect(page.locator("main#main")).toContainText(data.exam_name);
    await watch.open(urlOf(entry, { exam: exam.key, view: "session" }));
    await expectLoaded(page, entry);
    await expect(page.locator("main#main")).toContainText(data.session.card.front);
    expectNoProblems(watch, "normal", `${exam.key}：`);
  }
});

async function pressForToast(page: Page, target: Locator): Promise<void> {
  await target.press("Enter");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: copy("soon") })
      .last(),
  ).toBeVisible();
}

test("S15 工作区：卡组管理、待确认与日历，以及 AI 制卡五个来源", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const button = (name: string): Locator => main.getByRole("button", { name, exact: true }).first();

  await main.getByRole("tab", { name: copy("tabs.groups"), exact: true }).press("Enter");
  await expect(main.getByRole("heading", { name: copy("groups.title"), exact: true })).toBeVisible();
  await pressForToast(page, button(copy("groups.pause")));
  await pressForToast(page, button(copy("groups.bury")));
  await pressForToast(page, button(copy("groups.edit")));

  await main.getByRole("tab", { name: copy("tabs.pending"), exact: true }).press("Enter");
  await expect(main.getByText(copy("pending.title"), { exact: true })).toBeVisible();
  await expect(main).toContainText("AI 生成");
  await pressForToast(page, button(copy("pending.accept")));
  await pressForToast(page, button(copy("pending.discard")));
  await button(copy("pending.edit")).press("Enter");
  const edit = page.getByRole("dialog", { name: copy("pending.edit_title"), exact: true });
  await expect(edit).toBeVisible();
  await expect(edit.getByLabel(copy("pending.front"), { exact: true })).toBeVisible();
  await edit.getByRole("button", { name: copy("pending.cancel"), exact: true }).press("Enter");

  await main.getByRole("tab", { name: copy("tabs.calendar"), exact: true }).press("Enter");
  await expect(main.getByRole("heading", { name: copy("calendar.title"), exact: true })).toBeVisible();
  await expect(main).toContainText(copy("calendar.overloaded"));

  await button(copy("ai")).press("Enter");
  const create = page.getByRole("dialog", { name: copy("create.title"), exact: true });
  await expect(create).toBeVisible();
  for (const key of ["point", "explanation", "selection", "note", "mistake"])
    await expect(create.getByRole("option", { name: copy(`create.${key}`), exact: true })).toHaveCount(1);
  await pressForToast(page, create.getByRole("button", { name: copy("create.generate"), exact: true }));
  expectNoProblems(watch, "normal");
});

test("S15 先回忆再翻面：四档无默认、短暂防误触，退出恢复落地页", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  let main = page.locator("main#main");
  await main.getByRole("button", { name: copy("queue.start"), exact: true }).press("Enter");
  await expect(page.locator("[data-mode]").first()).toHaveAttribute("data-mode", "immersive");
  main = page.locator("main#main");
  await expect(main.getByRole("button", { name: copy("session.again"), exact: true })).toHaveCount(0);
  await main.getByRole("button", { name: copy("session.flip"), exact: true }).press("Enter");
  const ratings = ["again", "hard", "good", "easy"].map((key) => main.getByRole("button", { name: copy(`session.${key}`), exact: true }));
  for (const rating of ratings) {
    await expect(rating).toBeVisible();
    await expect(rating).not.toHaveAttribute("aria-pressed", "true");
    await expect(rating).toBeEnabled();
  }
  await pressForToast(page, ratings[0]!);
  await expect(main).toContainText(copy("session.demo"));
  await expect(main.getByRole("link", { name: copy("session.source"), exact: true })).toHaveAttribute("href", /^\/reader\//);
  await main.getByRole("button", { name: copy("session.exit"), exact: true }).press("Enter");
  await expect(page.locator("[data-mode]").first()).toHaveAttribute("data-mode", "standard");
  await expect(page.locator("main#main").getByRole("heading", { name: copy("queue.title"), exact: true })).toBeVisible();
  expectNoProblems(watch, "normal");
});
