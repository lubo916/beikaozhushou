import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { ROOT } from "../support/env.ts";
import { pathTo } from "../../../apps/org/src/routes.ts";
const COPY = JSON.parse(readFileSync(join(ROOT, "apps/org/src/i18n/zh-CN/O01.json"), "utf8")) as Record<string, unknown>;
function copy(key: string): string {
  let node: unknown = COPY;
  for (const part of key.split(".")) node = (node as Record<string, unknown>)[part];
  if (typeof node !== "string") throw new Error(`O01 文案不存在：${key}`);
  return node;
}
const entry = pageById("O01");
for (const width of [375, 834, 1280])
  test(`O01 ${width} 布局与正文无溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(urlOf(entry));
    const main = page.locator("main#main");
    await expect(main.getByRole("heading", { name: copy("health"), exact: true })).toBeVisible();
    const a = await main.locator(".ui-cols__main").boundingBox();
    const b = await main.locator(".ui-cols__aside").boundingBox();
    if (a === null || b === null) throw new Error("未找到双栏容器");
    if (width === 1280) expect(b.x).toBeGreaterThanOrEqual(a.x + a.width - 1);
    else expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
    expect(await main.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath(`O01-${width}.png`), fullPage: true });
  });
test("O01 无多视图，四考试与七态可打开", async ({ page }) => {
  expect(entry.views).toEqual([]);
  for (const exam of ["kj", "js", "en", "ds"]) {
    await page.goto(urlOf(entry, { exam }));
    await expect(page.locator("main#main").getByRole("heading", { name: copy("health"), exact: true })).toBeVisible();
  }
  for (const state of ["loading", "empty", "error", "offline", "restricted", "insufficient_data"]) {
    await page.goto(urlOf(entry, { state }));
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    await expect(shown).toBeVisible();
    if (state === "restricted" || state === "insufficient_data") await expect(page.locator("main#main .ui-ai")).toHaveCount(0);
    if (state === "empty")
      await expect(shown.getByRole("link", { name: copy("state.empty.action") })).toHaveAttribute("href", pathTo("O03"));
    if (["error", "offline", "restricted"].includes(state)) await expect(shown).toContainText(copy(`state.${state}.body`));
  }
});
test("O01 角色与组织预设、范围、口径及主要按钮可用", async ({ page }) => {
  await page.goto(urlOf(entry));
  const main = page.locator("main#main");
  await expect(main.getByRole("heading", { name: copy("health"), exact: true })).toBeVisible();
  await main.getByRole("combobox", { name: copy("role") }).selectOption("advisor");
  await expect(main.getByRole("combobox", { name: copy("scope") })).toBeDisabled();
  await expect(main).toContainText(copy("todos.contact"));
  await main.getByRole("combobox", { name: copy("role") }).selectOption("org_owner");
  await main.getByRole("combobox", { name: copy("scope") }).selectOption("east");
  await main.getByRole("combobox", { name: copy("organization") }).selectOption("enterprise");
  await expect(main).toContainText(copy("metrics.required"));
  await main
    .getByRole("button", { name: copy("method"), exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText(copy("methodBody"));
  await page.keyboard.press("Escape");
  for (const label of ["customize", "publish", "weeklyAction"]) {
    await main.getByRole("button", { name: copy(label), exact: true }).press("Enter");
    await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
  }
  await expect(main.getByRole("link", { name: copy("overview") })).toHaveAttribute("href", pathTo("O13"));
});
