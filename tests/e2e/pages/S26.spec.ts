// S26 简版只读信息：主视图、七态、三档宽度、数据挂载与来源说明。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const copy = JSON.parse(readFileSync(join(ROOT, "apps/learner/src/i18n/zh-CN/S26.json"), "utf8")) as {
  title: string;
  disclaimer: string;
  options: string;
  detail: string;
  detail_title: string;
  close: string;
  goal: string;
  state: Record<string, { title: string; body: string; action: string }>;
};
const entry = pageById("S26");

for (const width of [375, 834, 1280]) {
  test(`S26 ${width} 宽主视图可打开且无横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry));
    await expectOpened(page, entry, undefined);
    await expectLoaded(page, entry);
    await expect(page.getByRole("heading", { level: 1, name: copy.title, exact: true })).toBeVisible();
    await expect(page.locator("main#main")).toContainText(copy.disclaimer);
    await expect(page.getByRole("table", { name: copy.options })).toBeVisible();
    await expect(page.getByTestId("s26-source")).toBeVisible();
    const overflow = await page.locator("main#main").evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `.test-results/U25/S26@${width}.png`, fullPage: false });
    expectNoProblems(watch, "normal");
  });
}

test("S26 简版只有主视图", () => {
  expect(entry.views).toEqual([]);
});

for (const state of ABNORMAL_STATES) {
  test(`S26 ${state} 状态文案与原型一致`, async ({ page }) => {
    const watch = await watchPage(page);
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    const text = copy.state[state];
    if (text !== undefined) {
      await expect(shown).toContainText(text.title);
      await expect(shown).toContainText(text.body);
    }
    await expect(page.locator("main#main")).toContainText(copy.disclaimer);
    expectNoProblems(watch, state);
  });
}

for (const exam of ["kj", "js", "en", "ds"]) {
  test(`S26 ${exam} 按配置挂载，无数据时不显示选项`, async ({ page }) => {
    const watch = await watchPage(page);
    await watch.open(urlOf(entry, { exam }));
    if (exam === "kj") {
      await expectLoaded(page, entry);
      await expect(page.getByRole("table", { name: copy.options })).toBeVisible();
    } else {
      await expect(page.locator("main#main .ui-state--empty")).toContainText(copy.state["empty"]?.title ?? "");
      await expect(page.getByRole("table", { name: copy.options })).toHaveCount(0);
    }
    expectNoProblems(watch, "normal");
  });
}

test("S26 查看选项可开关，目标入口使用路由路径", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  await page.locator("main#main").getByRole("button", { name: copy.detail, exact: true }).first().press("Enter");
  const dialog = page.getByRole("dialog", { name: copy.detail_title });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("演示选项");
  await dialog.getByRole("button", { name: copy.close, exact: true }).last().press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.locator("main#main").getByRole("link", { name: copy.goal, exact: true })).toHaveAttribute("href", "/goals");
  expectNoProblems(watch, "normal");
});

for (const exam of ["js", "en", "ds"]) {
  for (const state of ["restricted", "insufficient_data"] as const) {
    test(`S26 ${exam} 强制 ${state} 且选项仍不挂载`, async ({ page }) => {
      const watch = await watchPage(page);
      await watch.open(urlOf(entry, { exam, state }));
      await expectState(page, entry, state);
      await expect(page.getByRole("table", { name: copy.options })).toHaveCount(0);
      expectNoProblems(watch, state);
    });
  }
}
