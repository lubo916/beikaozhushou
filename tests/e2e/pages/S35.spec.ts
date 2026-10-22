import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const copy = JSON.parse(readFileSync(join(ROOT, "apps/learner/src/i18n/zh-CN/S35.json"), "utf8")) as Record<string, unknown>;
function text(path: string): string {
  let value: unknown = copy;
  for (const key of path.split(".")) value = (value as Record<string, unknown>)[key];
  if (typeof value !== "string") throw new Error(`缺少文案 ${path}`);
  return value;
}
const entry = pageById("S35");

for (const size of [
  { width: 375, height: 812, split: false },
  { width: 834, height: 900, split: false },
  { width: 1280, height: 900, split: true },
]) {
  test(`S35 ${size.width} 布局与正文无溢出`, async ({ page }, testInfo) => {
    await page.setViewportSize(size);
    const watch = await watchPage(page);
    await watch.open(urlOf(entry));
    await expectLoaded(page, entry);
    const main = await page.locator("main#main .ui-cols__main").boundingBox();
    const aside = await page.locator("main#main .ui-cols__aside").boundingBox();
    expect(main).not.toBeNull();
    expect(aside).not.toBeNull();
    if (main && aside) {
      if (size.split) expect(aside.x).toBeGreaterThanOrEqual(main.x + main.width - 1);
      else expect(aside.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
    }
    expect(await page.locator("main#main").evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expectNoProblems(watch, "normal");
    await page.screenshot({ path: testInfo.outputPath(`S35-${size.width}.png`), fullPage: true });
  });
}
test("S35 无额外视图，四个演示考试可打开", async ({ page }) => {
  expect(entry.views).toEqual([]);
  const watch = await watchPage(page);
  for (const exam of ["kj", "js", "en", "ds"]) {
    await watch.open(urlOf(entry, { exam }));
    await expectLoaded(page, entry);
    await expect(page.getByRole("heading", { level: 1, name: text("title"), exact: true })).toBeVisible();
    expectNoProblems(watch, "normal");
  }
});
test("S35 七态文案与局部受限，空态仍有帮助和客服", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    if (state === "empty") {
      await expect(page.locator(".ui-state--empty")).toContainText(text("state.empty.title"));
      await expect(page.getByRole("link", { name: text("state.empty.action"), exact: true })).toHaveAttribute("href", "/settings");
      await expect(page.getByRole("heading", { name: text("service.title"), exact: true })).toBeVisible();
    }
    if (state === "offline")
      await expect(
        page.locator(".ui-state--offline").getByRole("button", { name: text("state.offline.retry"), exact: true }),
      ).toBeVisible();
    if (state === "restricted") {
      await expect(page.locator(".ui-state--restricted")).toContainText(text("state.restricted.body"));
      await expect(page.getByRole("heading", { name: text("notification.title"), exact: true })).toBeVisible();
    }
    if (state === "insufficient_data")
      await expect(page.locator(".ui-state--insufficient_data")).toContainText(text("state.insufficient_data.body"));
    if (state === "error") await expect(page.locator(".ui-state--error")).toContainText(text("state.error.body"));
    expectNoProblems(watch, state);
  }
});
test("S35 通知筛选与直达、公告、授权说明、客服与工单可操作", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const group = main.getByRole("group", { name: text("notification.filter") });
  await group.getByRole("button", { name: text("notification.security"), exact: true }).press("Enter");
  await expect(main.getByRole("link", { name: text("notification.open"), exact: true })).toHaveCount(1);
  await expect(main.getByRole("link", { name: text("notification.open"), exact: true })).toHaveAttribute("href", "/settings");
  await group.getByRole("button", { name: text("notification.all"), exact: true }).press("Enter");
  await main
    .getByRole("button", { name: text("notification.mark"), exact: true })
    .first()
    .press("Enter");
  await expect(page.getByRole("status").filter({ hasText: text("soon.read") })).toBeVisible();
  await main.getByRole("button", { name: text("announcement.detail"), exact: true }).press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await main.getByRole("button", { name: text("push.action"), exact: true }).press("Enter");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: text("push.confirm"), exact: true })
    .press("Enter");
  await expect(page.getByRole("status").filter({ hasText: text("soon.push") })).toBeVisible();
  await main.getByRole("textbox", { name: text("service.question"), exact: true }).fill("提醒怎样设置");
  await main.getByRole("button", { name: text("service.ask"), exact: true }).press("Enter");
  await expect(page.getByRole("dialog").locator(".ui-ai")).toBeVisible();
  await page.keyboard.press("Escape");
  await main
    .getByRole("button", { name: text("tickets.detail"), exact: true })
    .first()
    .press("Enter");
  const ticket = page.getByRole("dialog");
  await expect(ticket).toContainText(text("tickets.conclusion"));
  await ticket.getByRole("button", { name: text("tickets.satisfied"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: text("soon.satisfaction") })).toBeVisible();
  await page.keyboard.press("Escape");
  await main.locator("details summary").first().press("Enter");
  await expect(main.locator("details").first()).toHaveAttribute("open", "");
  expectNoProblems(watch, "normal");
});
test("S35 反馈与人工客服带页面和订单，空内容不发送", async ({ page }) => {
  const watch = await watchPage(page);
  const url = new URL(urlOf(entry));
  url.searchParams.set("order_id", "DEMO-ORDER-33");
  url.searchParams.set("from", "/membership");
  await watch.open(url.href);
  await expectLoaded(page, entry);
  await page
    .locator("main#main")
    .getByRole("button", { name: text("service.feedback"), exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: text("service.feedback"), exact: true });
  await expect(dialog).toContainText("DEMO-ORDER-33");
  await expect(dialog).toContainText("/membership");
  await dialog.getByRole("button", { name: text("service.submit"), exact: true }).press("Enter");
  await expect(dialog.getByRole("alert")).toHaveText(text("feedback_validation"));
  await dialog.getByRole("textbox", { name: text("service.message"), exact: true }).fill("请协助核对订单状态");
  await dialog.getByRole("button", { name: text("service.submit"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: text("soon.feedback") })).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .locator("main#main")
    .getByRole("button", { name: text("service.human"), exact: true })
    .press("Enter");
  await expect(page.getByRole("dialog")).toContainText(text("service.outside"));
  await expect(page.getByRole("dialog")).toContainText("DEMO-ORDER-33");
  expectNoProblems(watch, "normal");
});
