// S34 冒烟：三档布局、单一视图、七态、四考试、主要入口与按钮。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator } from "@playwright/test";
import copy from "../../../apps/learner/src/i18n/zh-CN/S34.json" with { type: "json" };
import { pathTo } from "../../../apps/learner/src/routes.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const entry = pageById("S34");
const mainOf = "main#main";
const sizes = [
  { width: 375, height: 812, split: false },
  { width: 834, height: 900, split: false },
  { width: 1280, height: 900, split: true },
];

for (const size of sizes) {
  test(`S34 ${size.width} 宽布局与正文不溢出`, async ({ page }, info) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry));
    await expectLoaded(page, entry);
    const main = page.locator(mainOf);
    await expect(main.getByRole("heading", { level: 1, name: copy.title, exact: true })).toBeVisible();
    const left = await main.locator(".ui-cols__main").boundingBox();
    const right = await main.locator(".ui-cols__aside").boundingBox();
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    if (left !== null && right !== null) {
      if (size.split) expect(right.x).toBeGreaterThanOrEqual(left.x + left.width - 1);
      else expect(right.y).toBeGreaterThanOrEqual(left.y + left.height - 1);
    }
    expect(await main.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath(`S34-${size.width}.png`), fullPage: false });
    expectNoProblems(watch, "normal");
  });
}

test("S34 单一视图与全部七态", async ({ page }) => {
  expect(entry.views).toEqual([]);
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    const main = page.locator(mainOf);
    if (state === "empty") {
      await expect(main.getByRole("heading", { level: 1, name: copy.title, exact: true })).toBeVisible();
      await expect(main.locator(".ui-state--empty")).toContainText(copy.state.empty.body);
      await expect(main.getByRole("link", { name: copy.state.empty.action, exact: true })).toHaveAttribute("href", pathTo("S06"));
    }
    if (state === "offline") await expect(main.locator(".ui-state--offline")).toContainText(copy.state.offline.body);
    if (state === "restricted") {
      await expect(main.locator(".ui-state--restricted")).toContainText(copy.state.restricted.body);
      await expect(main.getByRole("heading", { name: copy.goals.title, exact: true })).toBeVisible();
    }
    if (state === "insufficient_data") {
      await expect(main.locator(".ui-state--insufficient_data")).toContainText(copy.state.insufficient.body);
      await expect(main.getByRole("heading", { name: copy.milestones.title, exact: true })).toBeVisible();
      await expect(main.getByRole("heading", { name: copy.history.title, exact: true })).toBeVisible();
      await expect(main.getByRole("table", { name: copy.comparison.caption })).toHaveCount(0);
    }
    expectNoProblems(watch, state);
  }
});

test("S34 四个演示考试来自各自 fixture", async ({ page }) => {
  const watch = await watchPage(page);
  const index = JSON.parse(readFileSync(join(ROOT, "fixtures/exams/index.json"), "utf8")) as { exams: { key: string; exam_id: string }[] };
  for (const exam of index.exams) {
    const data = JSON.parse(readFileSync(join(ROOT, `fixtures/pages/S34/${exam.exam_id}.json`), "utf8")) as { goals: { name: string }[] };
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectLoaded(page, entry);
    await expect(
      page
        .locator(mainOf)
        .getByText(data.goals[0]?.name ?? "", { exact: true })
        .first(),
    ).toBeVisible();
    expectNoProblems(watch, "normal");
  }
});

test("S34 主要按钮可用并跳到登记路由", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator(mainOf);
  const pressFor = async (name: string, message: string) => {
    const button: Locator = main.getByRole("button", { name, exact: true }).first();
    await button.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: message })).toBeVisible();
  };
  for (const [name, message] of [
    [copy.profile.export, copy.soon.export],
    [copy.goals.pause, copy.soon.pause],
    [copy.goals.resume, copy.soon.resume],
    [copy.goals.archive, copy.soon.archive],
    [copy.packages.manage, copy.soon.packages],
    [copy.packages.update, copy.soon.update],
    [copy.packages.withdraw, copy.soon.withdraw],
  ] as const)
    await pressFor(name, message);
  for (const [name, route] of [
    [copy.goals.add, "S02"],
    [copy.profile.membership, "S31"],
    [copy.history.report, "S08"],
  ] as const)
    await expect(main.getByRole("link", { name, exact: true }).first()).toHaveAttribute("href", pathTo(route));
  for (const id of ["S08", "S11", "S31", "S32", "S33", "S35"] as const) {
    await expect(
      main.getByRole("navigation", { name: copy.shortcuts.title }).getByRole("link").filter({ hasText: copy.shortcuts.page[id] }),
    ).toHaveAttribute("href", pathTo(id));
  }
  await main.getByRole("link", { name: copy.goals.add, exact: true }).press("Enter");
  await expect(page).toHaveURL(new RegExp(pathTo("S02") + "$"));
  expectNoProblems(watch, "normal");
});
