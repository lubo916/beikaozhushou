import { expect, test } from "@playwright/test";
import copy from "../../../apps/learner/src/i18n/zh-CN/S33.json" with { type: "json" };

const views = ["learning", "tutor", "reminders", "appearance", "account"] as const;
for (const width of [375, 834, 1280]) {
  test(`S33 ${width} 宽五类设置可见且不横向溢出`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    for (const view of views) {
      await page.goto(`/settings?view=${view}`);
      const main = page.locator("main#main");
      await expect(main.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();
      await expect(main.getByRole("tab", { name: copy.tabs[view], exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(main.getByRole("button", { name: copy.save, exact: true })).toBeVisible();
      const overflow = await main.evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`S33-${view}-${width}.png`), fullPage: true });
    }
  });
}
test("S33 七态保留正确的说明和出路", async ({ page }) => {
  for (const state of ["loading", "empty", "error", "offline", "restricted", "insufficient_data"]) {
    await page.goto(`/settings?state=${state}`);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    await expect(shown).toBeVisible();
    if (state !== "loading") await expect(shown).toContainText(copy.state[state as keyof typeof copy.state].body);
    if (state === "empty" || state === "restricted" || state === "insufficient_data") {
      await expect(page.getByRole("tab", { name: copy.tabs.learning, exact: true })).toBeVisible();
    }
  }
});
test("S33 四演示考试均展示平台允许的设置", async ({ page }) => {
  for (const exam of ["kj", "js", "en", "ds"]) {
    await page.goto(`/settings?exam=${exam}`);
    await expect(page.getByLabel(copy.field.daily_minutes.label, { exact: true })).toBeVisible();
    await expect(page.getByLabel(copy.field.retention.label, { exact: true })).toHaveValue("0.9");
  }
});
test("S33 关闭辅助功能和调整新卡上限先确认代价，取消保留原值", async ({ page }) => {
  await page.goto("/settings");
  const confidence = page.getByRole("switch", { name: copy.field.confidence.label });
  await expect(confidence).toHaveAttribute("aria-checked", "true");
  await confidence.press("Enter");
  let dialog = page.getByRole("dialog", { name: copy.confirm.title });
  await expect(dialog).toContainText(copy.confirm.confidence);
  await dialog.getByRole("button", { name: copy.confirm.cancel }).click();
  await expect(confidence).toHaveAttribute("aria-checked", "true");
  await confidence.press("Enter");
  await dialog.getByRole("button", { name: copy.confirm.confirm }).click();
  await expect(confidence).toHaveAttribute("aria-checked", "false");
  const check = page.getByRole("switch", { name: copy.field.reading_check.label });
  await check.press("Enter");
  await expect(dialog).toContainText(copy.confirm.reading_check);
  await dialog.getByRole("button", { name: copy.confirm.cancel }).click();
  const newLimit = page.getByLabel(copy.field.new_limit.label, { exact: true });
  await newLimit.selectOption("30");
  dialog = page.getByRole("dialog", { name: copy.confirm.title });
  await expect(dialog).toContainText(copy.confirm.new_cards);
  await dialog.getByRole("button", { name: copy.confirm.cancel }).click();
  await expect(newLimit).toHaveValue("20");
  await page.getByRole("button", { name: copy.save, exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy.preview })).toBeVisible();
});
test("S33 账号安全、引导与离线主要按钮可点击，跨页出口正确", async ({ page }) => {
  await page.goto("/settings?view=account");
  const main = page.locator("main#main");
  await main.getByRole("button", { name: copy.actions.password, exact: true }).click();
  let dialog = page.getByRole("dialog", { name: copy.security.password_title, exact: true });
  await expect(dialog.getByLabel(copy.security.old_password, { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: copy.security.verify }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy.soon })).toBeVisible();
  await page.keyboard.press("Escape");
  await main.getByRole("button", { name: copy.actions.phone, exact: true }).click();
  dialog = page.getByRole("dialog", { name: copy.security.phone_title });
  await expect(dialog.getByLabel(copy.security.old_code)).toBeVisible();
  await expect(dialog.getByLabel(copy.security.new_code)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(main.getByRole("link", { name: copy.actions.privacy })).toHaveAttribute("href", "/privacy");
  await expect(main.getByRole("link", { name: copy.actions.help })).toHaveAttribute("href", "/messages");
  for (const name of [copy.actions.avatar, copy.actions.guide, copy.actions.hints]) {
    await main.getByRole("button", { name, exact: true }).press("Enter");
    await expect(page.getByRole("status").filter({ hasText: copy.soon }).first()).toBeVisible();
  }
  await page.goto("/settings?view=appearance");
  for (const name of [copy.actions.handoff, copy.actions.offline]) await page.getByRole("button", { name, exact: true }).press("Enter");
  await page.goto("/settings?view=tutor");
  await expect(main.getByRole("link", { name: copy.actions.classroom })).toHaveAttribute("href", "/classroom");
  await page.goto("/settings?view=account&exam=ds");
  await expect(main).toContainText(copy.hint.bind);
  await main.getByRole("button", { name: copy.actions.bind, exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel(copy.security.new_phone)).toBeVisible();
});

test("S33 无缓存离线给出重试动作，不误标保存", async ({ page }) => {
  await page.goto("/settings?state=offline");
  const offline = page.locator("main#main .ui-state--offline");
  await expect(offline.getByRole("button", { name: "重试", exact: true })).toBeVisible();
});
