import { expect, test } from "@playwright/test";
import copy from "../../../apps/learner/src/i18n/zh-CN/S25.json" with { type: "json" };
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectState, watchPage } from "../support/checks.ts";
const entry = pageById("S25");
for (const width of [375, 834, 1280]) {
  test(`S25 ${width}：主视图布局与主要信息`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry));
    await expectLoaded(page, entry);
    const main = page.locator("main#main");
    await expect(main.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();
    for (const title of [copy.timeline, copy.sessions, copy.announcements, copy.details, copy.reminders, copy.checklist])
      await expect(main.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(main.locator(".ui-cols__aside").getByRole("heading", { name: copy.accumulation, exact: true })).toBeVisible();
    const first = await main.locator(".ui-cols__main").boundingBox();
    const second = await main.locator(".ui-cols__aside").boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (first && second) {
      if (width === 1280) expect(second.x).toBeGreaterThanOrEqual(first.x + first.width - 1);
      else expect(second.y).toBeGreaterThanOrEqual(first.y + first.height - 1);
    }
    expect(await main.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `.test-results/U25/S25@${width}.png`, fullPage: false });
    await main.locator(".ui-cols__aside").getByRole("heading", { name: copy.accumulation, exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.test-results/U25/S25@${width}-bottom.png`, fullPage: false });
    expectNoProblems(watch, "normal");
  });
}
for (const exam of ["kj", "js", "en", "ds"]) {
  test(`S25 ${exam} 仅主视图且当前考试数据可打开`, async ({ page }) => {
    expect(entry.views).toEqual([]);
    const watch = await watchPage(page);
    await watch.open(urlOf(entry, { exam }));
    await expectLoaded(page, entry);
    await expect(page.locator("main#main").getByRole("heading", { name: copy.timeline, exact: true })).toBeVisible();
    expectNoProblems(watch, "normal");
  });
}

for (const state of ABNORMAL_STATES) {
  test(`S25 ${state} 状态文案与原型一致`, async ({ page }) => {
    const watch = await watchPage(page);
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy.state.empty.title);
      await expect(shown).toContainText(copy.state.empty.body);
      await shown.getByRole("button", { name: copy.add_node }).press("Enter");
      await expect(page.getByRole("status").filter({ hasText: copy.soon_node })).toBeVisible();
    }
    if (state === "offline") await expect(shown).toContainText(copy.state.offline.body);
    if (state === "restricted") {
      await expect(shown).toContainText(copy.state.restricted.title);
      await expect(page.locator("main#main").getByRole("heading", { name: copy.timeline, exact: true })).toBeVisible();
    }
    if (state === "insufficient_data") await expect(shown).toContainText(copy.state.insufficient.title);
    expectNoProblems(watch, state);
  });
}

test("S25 主要按钮和跨页路径；AI 提议不会直接改计划", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  for (const [name, message] of [
    [copy.add_node, copy.soon_node],
    [copy.configure, copy.soon_reminder],
    [copy.bind, copy.soon],
    [copy.proposal, copy.soon_proposal],
    [copy.material, copy.soon],
    [copy.card, copy.soon],
    [copy.check.replace("{{category}}", copy.category.documents), copy.soon],
  ]) {
    if (name === undefined || message === undefined) throw new Error("按钮缺少文案");
    await main.getByRole("button", { name, exact: true }).first().press("Enter");
    await expect(page.getByRole("status").filter({ hasText: message })).toBeVisible();
  }
  await expect(main.getByRole("link", { name: copy.goals })).toHaveAttribute("href", "/goals");
  await expect(main.getByRole("link", { name: copy.original })).toHaveAttribute("href", /^https:\/\//);
  await expect(main.getByRole("link", { name: copy.official })).toHaveAttribute("href", /^https:\/\//);
  await expect(main).toContainText(copy.pending);
  expectNoProblems(watch, "normal");
});
