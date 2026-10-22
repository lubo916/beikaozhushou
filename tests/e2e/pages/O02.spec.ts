import { expect, test } from "@playwright/test";
import copy from "../../../apps/org/src/i18n/zh-CN/O02.json" with { type: "json" };
import { pathTo } from "../../../apps/org/src/routes.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectState, watchPage } from "../support/checks.ts";

const entry = pageById("O02");
for (const width of [375, 834, 1280]) {
  test(`O02 ${width} 宽：主视图可用且正文不横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry));
    await expectLoaded(page, entry);
    await expect(page.getByRole("heading", { name: copy.pool.title, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: copy.compliance.title, exact: true })).toBeVisible();
    const main = page.locator("main#main");
    expect(await main.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    const first = await main.locator(".ui-cols__main").boundingBox();
    const aside = await main.locator(".ui-cols__aside").boundingBox();
    expect(first).not.toBeNull();
    expect(aside).not.toBeNull();
    if (first !== null && aside !== null) {
      if (width === 1280) expect(aside.x).toBeGreaterThanOrEqual(first.x + first.width - 1);
      else expect(aside.y).toBeGreaterThanOrEqual(first.y + first.height - 1);
    }
    expectNoProblems(watch, "normal");
    await page.screenshot({ path: test.info().outputPath(`O02-${width}.png`), fullPage: true });
  });
}
test("O02 主视图与七态均可打开，受限不展示联系资料，小样本不展示比例", async ({ page }) => {
  expect(entry.views).toEqual([]);
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    const main = page.locator("main#main");
    if (state === "empty") {
      await expect(main).toContainText(copy.state.empty.body);
      await expect(main.getByRole("link", { name: copy.state.empty.action })).toHaveAttribute("href", pathTo("O03"));
    }
    if (state === "restricted") {
      await expect(main).toContainText(copy.state.restricted.body);
      await expect(main.getByRole("heading", { name: copy.pool.title, exact: true })).toHaveCount(0);
      await expect(main).not.toContainText("138****2046");
    }
    if (state === "insufficient_data") {
      await expect(main.getByRole("heading", { name: copy.state.insufficient_data.title })).toBeVisible();
      await expect(main).not.toContainText(copy.summary.conversion);
    }
    if (state === "offline") await expect(main).toContainText(copy.state.offline.body);
    if (state === "error") await expect(main).toContainText(copy.state.error.body);
    expectNoProblems(watch, state);
  }
});
test("O02 四个演示考试和主要按钮可用", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of ["kj", "js", "en", "ds"]) {
    await watch.open(urlOf(entry, { exam }));
    await expectLoaded(page, entry);
    await expect(page.getByRole("heading", { name: copy.pool.title, exact: true })).toBeVisible();
    expectNoProblems(watch, "normal");
  }
  const main = page.locator("main#main");
  for (const name of [
    copy.action.add,
    copy.action.diagnostic,
    copy.action.follow,
    copy.action.trial,
    copy.action.enroll,
    copy.action.refund,
    copy.action.check,
  ]) {
    await main.getByRole("button", { name, exact: true }).first().press("Enter");
    await expect(page.getByRole("status").filter({ hasText: copy.soon })).toBeVisible();
  }
  await main.getByRole("button", { name: copy.action.details, exact: true }).first().press("Enter");
  const dialog = page.getByRole("dialog", { name: copy.communication.title, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("AI 生成");
  await dialog.getByRole("button", { name: copy.action.close, exact: true }).first().press("Enter");
  await expect(dialog).toBeHidden();
  await main.getByLabel(copy.compliance.label).fill("");
  await main.getByRole("button", { name: copy.action.check, exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy.compliance.empty })).toBeVisible();
  expectNoProblems(watch, "normal");
});

test("O02 打开沟通弹窗后切考试、受限或空态，不保留旧线索内容", async ({ page }) => {
  for (const change of ["exam=js", "state=restricted", "state=empty"]) {
    await page.goto(urlOf(entry));
    const main = page.locator("main#main");
    await main.getByRole("button", { name: copy.action.details, exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: copy.communication.title, exact: true });
    await expect(dialog).toBeVisible();
    await page.evaluate((query) => {
      window.history.pushState({}, "", `?${query}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, change);
    await expect(dialog).toBeHidden();
    if (change === "exam=js") await expect(main.getByRole("heading", { name: copy.pool.title, exact: true })).toBeVisible();
    else await expect(main.locator(`.ui-state--${change.split("=")[1]}`).first()).toBeVisible();
  }
});
