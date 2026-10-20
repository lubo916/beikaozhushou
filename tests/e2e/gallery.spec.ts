/// <reference lib="dom" />

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [375, 834, 1280] as const;
const STATES = [
  { label: "加载", code: "loading" },
  { label: "空", code: "empty" },
  { label: "出错", code: "error" },
  { label: "离线", code: "offline" },
  { label: "受限", code: "restricted" },
  { label: "数据不足", code: "insufficient_data" },
  { label: "锁定", code: "locked" },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), {
      message: "整个页面不应横向滚动",
    })
    .toBeLessThanOrEqual(1);
}

test.describe("公共组件陈列页 gallery（三档真实截图）", () => {
  for (const width of WIDTHS) {
    test(`${width}：组件、七态与交互可用，保存真实整页截图`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const runtimeErrors: string[] = [];
      page.on("pageerror", (error) => runtimeErrors.push(error.message));

      await page.goto("/dev/ui");
      await expect(page.getByRole("heading", { name: "公共组件陈列", exact: true })).toBeVisible();
      await expect(page.getByRole("radiogroup", { name: "预览宽度" }).getByRole("radio", { name: "跟随窗口" })).toBeChecked();
      await page.evaluate(async () => document.fonts.ready);

      const sections = page.locator("section.dev-section");
      expect(await sections.count()).toBeGreaterThan(20);
      const sectionTargets = await sections.evaluateAll((elements) => elements.map((element) => `#${element.id}`));
      const directoryTargets = await page
        .getByRole("navigation", { name: "目录" })
        .getByRole("link")
        .evaluateAll((elements) => elements.map((element) => element.getAttribute("href")));
      expect(directoryTargets).toEqual(sectionTargets);
      for (const id of ["tokens", "button", "proposal", "states", "ladder", "grid", "task", "overlay"]) {
        await expect(page.locator(`#${id}`)).toBeVisible();
      }
      await expectNoHorizontalOverflow(page);

      // 直接截取真实页面；不使用受 ignoreSnapshots 影响的 toHaveScreenshot。
      const galleryDirectory = resolve(".test-results/gallery", testInfo.project.name);
      await mkdir(galleryDirectory, { recursive: true });
      const screenshotPath = resolve(galleryDirectory, `${width}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true, scale: "css", animations: "disabled" });
      await testInfo.attach(`组件陈列页-${width}`, { path: screenshotPath, contentType: "image/png" });

      const states = page.locator("#states");
      const stateOptions = states.getByRole("radiogroup", { name: "页面状态", exact: true });
      const stateDisplay = states.locator(".ui-card").first();
      await expect(stateDisplay.getByText("这里是今日的内容。", { exact: true })).toBeVisible();
      for (const state of STATES) {
        const option = stateOptions.getByRole("radio", { name: state.label, exact: true });
        await option.click();
        await expect(option).toBeChecked();
        await expect(stateDisplay.locator(`.ui-state--${state.code}`)).toBeVisible();
        if (state.code === "error") {
          await expect(stateDisplay.getByRole("alert")).toContainText("今日没能加载");
          await expect(stateDisplay.getByRole("button", { name: "重试", exact: true })).toBeVisible();
        }
        await expectNoHorizontalOverflow(page);
      }
      await states.getByRole("radiogroup", { name: "页面", exact: true }).getByRole("radio", { name: "知识点主页" }).click();
      await stateOptions.getByRole("radio", { name: "空", exact: true }).click();
      await expect(stateDisplay.getByRole("heading", { name: "这个知识点还没有内容" })).toBeVisible();
      const normal = stateOptions.getByRole("radio", { name: "正常", exact: true });
      await normal.focus();
      await page.keyboard.press("ArrowRight");
      await expect(stateOptions.getByRole("radio", { name: "加载", exact: true })).toBeFocused();
      await expect(stateDisplay.locator(".ui-state--loading")).toBeVisible();

      const proposal = page.locator("#proposal .ui-proposal").first();
      await proposal.getByRole("button", { name: "确认", exact: true }).click();
      await expect(proposal.getByText("已确认", { exact: true })).toBeVisible();
      await proposal.getByRole("button", { name: "撤销", exact: true }).click();
      await expect(proposal.getByText("已撤销", { exact: true })).toBeVisible();
      await expect(proposal.getByRole("button")).toHaveCount(0);

      const openDialog = page.getByRole("button", { name: "打开对话框", exact: true });
      await openDialog.click();
      const dialog = page.getByRole("dialog", { name: "加入今日", exact: true });
      await expect(dialog).toBeVisible();
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(openDialog).toBeFocused();

      const openSheet = page.getByRole("button", { name: "打开底部面板", exact: true });
      await openSheet.click();
      const sheet = page.getByRole("dialog", { name: "问导师", exact: true });
      await expect(sheet).toBeVisible();
      await sheet.getByRole("button", { name: "关闭", exact: true }).click();
      await expect(sheet).not.toBeVisible();
      await expect(openSheet).toBeFocused();

      const display = page.getByRole("group", { name: "显示设置", exact: true });
      await display.getByRole("button", { name: "大字号", exact: true }).click();
      await display.getByRole("button", { name: "色觉友好配色", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("data-text", "large");
      await expect(page.locator("html")).toHaveAttribute("data-vision", "cvd");
      await expectNoHorizontalOverflow(page);
      expect(runtimeErrors, "陈列页及组件交互不应产生浏览器运行错误").toEqual([]);
    });
  }
});
