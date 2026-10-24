// S27 冲刺与考后：两视图、三档布局、七态、四考试与关键交互。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { pathTo } from "../../../apps/learner/src/routes.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const entry = pageById("S27");
const copy = JSON.parse(readFileSync(join(ROOT, "apps/learner/src/i18n/zh-CN/S27.json"), "utf8")) as Record<string, unknown>;
const exams = JSON.parse(readFileSync(join(ROOT, "fixtures/exams/index.json"), "utf8")) as {
  readonly exams: readonly { readonly key: string; readonly exam_id: string }[];
};
const VIEWS = ["sprint", "after"] as const;
const WIDTHS = [
  { width: 375, height: 812, split: false },
  { width: 834, height: 900, split: false },
  { width: 1280, height: 900, split: true },
] as const;

function text(key: string): string {
  let value: unknown = copy;
  for (const part of key.split("."))
    value = typeof value === "object" && value !== null ? (value as Record<string, unknown>)[part] : undefined;
  if (typeof value !== "string") throw new Error(`S27 缺少文案 ${key}`);
  return value;
}

function title(page: Page): Locator {
  return page.locator("main#main").getByRole("heading", { level: 1, name: text("title"), exact: true });
}

async function boxOf(locator: Locator) {
  const box = await locator.first().boundingBox();
  if (box === null) throw new Error("页面栏目未显示");
  return box;
}

for (const view of VIEWS) {
  for (const size of WIDTHS) {
    test(`S27 ${view} ${size.width} 宽：布局与正文无横向溢出`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      const watch = await watchPage(page);
      await watch.open(urlOf(entry, { view }));
      await expectOpened(
        page,
        entry,
        entry.views.find((item) => item.key === view),
      );
      await expectLoaded(page, entry);
      await expect(title(page)).toBeVisible();
      await expect(page.getByTestId(`S27-${view}`)).toBeVisible();
      const main = await boxOf(page.locator("main#main .ui-cols__main"));
      const aside = await boxOf(page.locator("main#main .ui-cols__aside"));
      if (size.split) expect(aside.x, "宽屏副栏位于主栏右侧").toBeGreaterThanOrEqual(main.x + main.width - 1);
      else expect(aside.y, "窄屏副栏位于主栏下方").toBeGreaterThanOrEqual(main.y + main.height - 1);
      const overflow = await page.locator("main#main").evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      expectNoProblems(watch, "normal");
      await page.screenshot({ path: testInfo.outputPath(`S27-${view}-${size.width}.png`), fullPage: true });
      await page.locator("main#main").evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await page.screenshot({ path: testInfo.outputPath(`S27-${view}-${size.width}-bottom.png`), fullPage: true });
    });
  }

  test(`S27 ${view} 七态：状态与原型文案`, async ({ page }) => {
    const watch = await watchPage(page);
    for (const state of ABNORMAL_STATES) {
      await watch.open(urlOf(entry, { view, state }));
      await expectState(page, entry, state);
      const shown = page.locator(`main#main .ui-state--${state}`).first();
      if (state === "empty") {
        await expect(title(page)).toBeVisible();
        await expect(shown).toContainText(text("state.empty.title"));
        await expect(shown.getByRole("link", { name: text("state.empty.action") })).toHaveAttribute("href", pathTo("S06"));
      }
      if (state === "offline") await expect(shown).toContainText(text("state.offline.body"));
      if (state === "restricted") {
        await expect(shown).toContainText(text("state.restricted.body"));
        await expect(title(page)).toBeVisible();
      }
      if (state === "insufficient_data") {
        await expect(shown).toContainText(text("state.insufficient_data.body"));
        await expect(title(page)).toBeVisible();
      }
      expectNoProblems(watch, state);
    }
  });
}

test("S27 四个演示考试的两视图都能打开，数据属于当前考试", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of exams.exams) {
    const profile = JSON.parse(readFileSync(join(ROOT, `fixtures/exams/${exam.exam_id}/profile.json`), "utf8")) as {
      readonly name: string;
    };
    for (const view of VIEWS) {
      await watch.open(urlOf(entry, { view, exam: exam.key }));
      await expectLoaded(page, entry);
      await expect(page.locator("main#main")).toContainText(profile.name);
      expectNoProblems(watch, "normal", `${exam.key}/${view}：`);
    }
  }
});

test("S27 标签支持键盘切换，保留当前演示考试", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { exam: "js", view: "sprint" }));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const sprint = main.getByRole("tab", { name: text("views.sprint"), exact: true });
  const after = main.getByRole("tab", { name: text("views.after"), exact: true });
  await sprint.focus();
  await sprint.press("ArrowRight");
  await expect(after).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/[?&]view=after(?:&|$)/);
  await expect(page).toHaveURL(/[?&]exam=js(?:&|$)/);
  await expect(main.getByRole("heading", { name: text("after.estimate.title"), exact: true })).toBeVisible();
  await after.press("ArrowLeft");
  await expect(sprint).toHaveAttribute("aria-selected", "true");
  await expect(main.getByRole("heading", { name: text("sprint.today.title"), exact: true })).toBeVisible();
  expectNoProblems(watch, "normal");
});

async function expectSoon(page: Page, target: Locator): Promise<void> {
  await target.press("Enter");
  await expect(
    page
      .locator('[role="status"]')
      .filter({ hasText: text("soon") })
      .last(),
  ).toBeVisible();
}

test("S27 冲刺主要按钮可操作，提议确认前后都不会伪改计划", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "sprint" }));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const button = (key: string) => main.getByRole("button", { name: text(key), exact: true }).first();
  const proposal = main.locator(".ui-proposal");
  await expect(proposal).toHaveClass(/ui-proposal--pending/);
  const ui = JSON.parse(readFileSync(join(ROOT, "packages/ui/src/copy.zh-CN.json"), "utf8")) as {
    readonly action: { readonly confirm: string; readonly decline: string };
  };
  await expectSoon(page, proposal.getByRole("button", { name: ui.action.confirm, exact: true }));
  await expect(proposal).toHaveClass(/ui-proposal--pending/);
  await expectSoon(page, proposal.getByRole("button", { name: ui.action.decline, exact: true }));
  await expect(proposal).toHaveClass(/ui-proposal--pending/);
  for (const key of [
    "sprint.today.overview.action",
    "sprint.today.warm.action",
    "sprint.today.mistakes.action",
    "sprint.warmth.action",
    "sprint.sleep.action",
    "sprint.checklist.action",
    "sprint.sheet.action",
  ])
    await expectSoon(page, button(key));
  await expect(main.getByRole("link", { name: text("sprint.sheet.open"), exact: true })).toHaveAttribute("href", pathTo("S14"));
  await expect(main.getByRole("link", { name: text("sprint.quiet.action"), exact: true })).toHaveAttribute("href", pathTo("S33"));
  await expect(main.locator(".ui-ai")).toBeVisible();
  expect(await main.innerText()).not.toMatch(/\{\{[^}]+\}\}/);
  expectNoProblems(watch, "normal");
});

test("S27 考后估分、归档和三条分流可操作，成绩草稿不伪保存", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "after" }));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  await expectSoon(page, main.getByRole("button", { name: text("after.estimate.action"), exact: true }));
  await expectSoon(page, main.getByRole("button", { name: text("after.archive.action"), exact: true }));
  const links = [
    ["after.next.next_subject.action", "S02"],
    ["after.next.retry.action", "S08"],
    ["after.next.transfer.action", "S02"],
    ["after.archive.open", "S34"],
  ] as const;
  for (const [key, id] of links) await expect(main.getByRole("link", { name: text(key), exact: true })).toHaveAttribute("href", pathTo(id));

  const compare = main.getByRole("table", { name: text("after.compare.title"), exact: true });
  const before = await compare.innerText();
  await main.getByRole("button", { name: text("after.grades.action"), exact: true }).press("Enter");
  const dialog = page.getByRole("dialog", { name: text("after.grades.dialog"), exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(text("after.grades.hint"));
  await expect(dialog.getByRole("combobox", { name: text("after.grades.subject") })).toBeVisible();
  const fixture = JSON.parse(readFileSync(join(ROOT, "fixtures/pages/S27/junior-accounting.json"), "utf8")) as {
    readonly grades: readonly { readonly actual?: number }[];
  };
  const grade = fixture.grades[0]?.actual;
  if (grade === undefined) throw new Error("会计演示数据缺少成绩");
  await dialog.getByRole("spinbutton", { name: text("after.grades.score"), exact: true }).fill(String(grade));
  await expectSoon(page, dialog.getByRole("button", { name: text("after.grades.save"), exact: true }));
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText(text("soon"));
  await dialog.getByRole("button", { name: text("after.grades.cancel"), exact: true }).press("Enter");
  await expect(dialog).toBeHidden();
  expect(await compare.innerText()).toBe(before);
  expect(await main.innerText()).not.toMatch(/\{\{[^}]+\}\}/);
  expectNoProblems(watch, "normal");
});
