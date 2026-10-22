import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { pathTo } from "../../../apps/learner/src/routes.ts";
import { ROOT } from "../support/env.ts";

const copy: Record<string, unknown> = JSON.parse(readFileSync(join(ROOT, "apps/learner/src/i18n/zh-CN/S19.json"), "utf8"));
function text(key: string): string {
  let value: unknown = copy;
  for (const part of key.split(".")) value = (value as Record<string, unknown>)[part];
  if (typeof value !== "string") throw new Error(key);
  return value;
}
const views = ["today", "all", "insights"];
for (const width of [375, 834, 1280]) {
  test(`S19 ${width} 三视图、布局与无横向溢出`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const view of views) {
      await page.goto(`${pathTo("S19")}?view=${view}&exam=kj`);
      await expect(page.locator("main h1")).toHaveText(text("title"));
      await expect(page.locator("main .ui-stats")).toBeVisible();
      await expect(page.getByRole("tab", { name: text(`tabs.${view}`), exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("main .ui-cols")).toBeVisible();
      const main = await page.locator("main .ui-cols__main").boundingBox();
      const aside = await page.locator("main .ui-cols__aside").boundingBox();
      expect(main).not.toBeNull();
      expect(aside).not.toBeNull();
      if (width === 1280) expect(aside!.x).toBeGreaterThanOrEqual(main!.x + main!.width - 1);
      else expect(aside!.y).toBeGreaterThanOrEqual(main!.y + main!.height - 1);
      expect(await page.locator("main").evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath(`${view}-${width}.png`), fullPage: true });
      if (view === "today") {
        const lastAction = page.locator(".s19-detail").getByRole("button", { name: text("actions.remove"), exact: true });
        await lastAction.scrollIntoViewIfNeeded();
        await expect(lastAction).toBeVisible();
        await page.screenshot({ path: info.outputPath(`detail-end-${width}.png`), fullPage: true });
      }
    }
    expect(errors).toEqual([]);
  });
}

for (const state of ["loading", "empty", "error", "offline", "restricted", "insufficient_data"]) {
  test(`S19 七态 ${state}`, async ({ page }) => {
    await page.goto(`${pathTo("S19")}?state=${state}&exam=kj`);
    const panel = page.locator(`main .ui-state--${state}`).first();
    await expect(panel).toBeVisible();
    if (state === "empty") {
      await expect(panel).toContainText(text("state.empty_title"));
      await expect(panel.getByRole("link", { name: text("actions.practice") })).toHaveAttribute("href", pathTo("S17"));
    }
    if (state === "offline") await expect(panel).toContainText(text("state.offline_title"));
    if (state === "insufficient_data") {
      const fixture = JSON.parse(readFileSync(join(ROOT, "fixtures/pages/S19/junior-accounting.json"), "utf8")) as {
        insufficient_sample_count: number;
      };
      await expect(
        page
          .locator(".ui-stat")
          .filter({ hasText: text("stats.total") })
          .locator(".ui-stat__value"),
      ).toHaveText(String(fixture.insufficient_sample_count));
    }
    if (["restricted", "insufficient_data"].includes(state)) {
      await expect(page.getByRole("heading", { name: text("list.today_title"), exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: text("actions.retry"), exact: true })).toBeVisible();
      await page.getByRole("tab", { name: text("tabs.insights"), exact: true }).click();
      await expect(page.locator(`main .ui-state--${state}`)).toBeVisible();
      await expect(page.getByRole("heading", { name: text("insights.clusters"), exact: true })).toHaveCount(0);
    }
  });
}

test("S19 四考试与全部状态筛选、按知识点展示", async ({ page }) => {
  for (const [key, id] of [
    ["kj", "junior-accounting"],
    ["js", "teacher-qualification"],
    ["en", "cet-6"],
    ["ds", "ds-final-custom"],
  ]) {
    const fixture = JSON.parse(readFileSync(join(ROOT, `fixtures/pages/S19/${id}.json`), "utf8")) as {
      normal: { items: { stem: string }[] };
    };
    await page.goto(`${pathTo("S19")}?view=all&exam=${key}`);
    await expect(page.locator(".s19-row")).toHaveCount(4);
    await expect(page.locator(".s19-stem").first()).toHaveText(fixture.normal.items[0]!.stem);
    await page.getByLabel(text("filters.status"), { exact: true }).selectOption("graduated");
    await expect(page.locator(".s19-row")).toHaveCount(1);
    await expect(page.locator(".s19-detail")).toContainText(text("detail.archived"));
    await page.getByRole("button", { name: text("actions.reset"), exact: true }).click();
    await expect(page.locator(".s19-row")).toHaveCount(4);
    await page.getByRole("radio", { name: text("list.by_point"), exact: true }).click();
    await expect(page.locator(".s19-row")).toHaveCount(4);
  }
});

test("S19 主要按钮、订正、打印配置与分析点数确认", async ({ page }) => {
  await page.goto(`${pathTo("S19")}?exam=kj`);
  const main = page.locator("main");
  await expect(main.locator(".s19-row")).toHaveCount(3);
  await main.getByRole("button", { name: text("actions.photo"), exact: true }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(text("photo.body"));
  await dialog.getByRole("button", { name: text("actions.cancel"), exact: true }).click();
  await main.getByRole("button", { name: text("actions.export"), exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(text("export.hide"))).toBeChecked();
  await dialog.getByLabel(text("export.blank")).uncheck();
  await dialog.getByRole("button", { name: text("actions.print"), exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: text("soon") })).toBeVisible();
  await main.getByLabel(text("detail.signal"), { exact: true }).fill("先核对适用条件");
  await main.getByRole("button", { name: text("actions.save"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: text("soon_save") })).toBeVisible();
  await main.getByRole("button", { name: text("actions.retry"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: text("soon_retry") })).toBeVisible();
  await main.getByRole("button", { name: text("actions.card"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: text("soon_card") })).toBeVisible();
  await expect(main.getByRole("link", { name: text("actions.notes"), exact: true })).toHaveAttribute("href", pathTo("S14"));
  await main.locator(".s19-row input").first().check();
  await main.getByRole("button", { name: text("actions.batch"), exact: true }).press("Enter");
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("3 点");
  await dialog.getByRole("button", { name: text("actions.confirm"), exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: text("soon_analysis") })).toBeVisible();
  await page.getByRole("tab", { name: text("tabs.insights"), exact: true }).click();
  await expect(main.getByText("AI 生成", { exact: true }).first()).toBeVisible();
});

test("S19 重置筛选同时清除陷阱、顽固标签和批量选择", async ({ page }) => {
  await page.goto(`${pathTo("S19")}?view=all&exam=kj&trap=concept_swap`);
  await expect(page.locator(".s19-row")).toHaveCount(1);
  await page.locator(".s19-row input").check();
  await page.getByLabel(text("filters.stubborn"), { exact: true }).check();
  await expect(page.locator(".s19-row")).toHaveCount(0);
  await page
    .locator("main")
    .getByRole("button", { name: text("actions.reset"), exact: true })
    .first()
    .click();
  await expect(page.getByLabel(text("filters.stubborn"), { exact: true })).not.toBeChecked();
  await expect(page.locator(".s19-row")).toHaveCount(4);
  await expect(page.locator(".s19-row input:checked")).toHaveCount(0);
  await expect(page.locator("main").getByRole("button", { name: text("actions.batch"), exact: true })).toBeDisabled();
});

test("S19 从陷阱对应错题切回今日不残留隐藏筛选", async ({ page }) => {
  await page.goto(`${pathTo("S19")}?view=all&exam=kj&trap=concept_swap`);
  await expect(page.locator(".s19-row")).toHaveCount(1);
  await page.getByRole("tab", { name: text("tabs.today"), exact: true }).click();
  await expect(page.locator(".s19-row")).toHaveCount(3);
  await expect(page).not.toHaveURL(/trap=/);
});
