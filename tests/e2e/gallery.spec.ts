/// <reference lib="dom" />

import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { ALL_PAGES, pageLabel, urlOf, type PageEntry } from "./support/catalog.ts";
import {
  expectLoaded,
  expectOpened,
  firstLine,
  installActivityMarker,
  navigationProblem,
  settle,
  waitForAppReady,
} from "./support/checks.ts";
import { APP_NAMES, PAGE_GALLERY_TAG, ROOT, type AppKey } from "./support/env.ts";

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

// 每个独立场景都检查运行错误，避免截图、七态和交互共用一个 30 秒预算。
const componentTest = test.extend<{ componentPage: Page }>({
  componentPage: async ({ page }, use) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await use(page);
    expect(runtimeErrors, "陈列页及组件交互不应产生浏览器运行错误").toEqual([]);
  },
});

componentTest.describe("公共组件陈列页 gallery（三档真实截图）", () => {
  for (const width of WIDTHS) {
    componentTest.describe(`${width}`, () => {
      componentTest.beforeEach(async ({ componentPage: page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("/dev/ui");
        await expect(page.getByRole("heading", { name: "公共组件陈列", exact: true })).toBeVisible();
        await expect(page.getByRole("radiogroup", { name: "预览宽度" }).getByRole("radio", { name: "跟随窗口" })).toBeChecked();
        await page.evaluate(async () => document.fonts.ready);
      });

      componentTest("布局与组件完整，保存真实整页截图", async ({ componentPage: page }, testInfo) => {
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
      });

      // 每一条原有状态切换仍覆盖相邻的前一态；独立预算避免 WebKit 累计点击耗尽 30 秒。
      for (const [index, state] of STATES.entries()) {
        componentTest(`${state.label}态可用且没有横向滚动`, async ({ componentPage: page }) => {
          const states = page.locator("#states");
          const stateOptions = states.getByRole("radiogroup", { name: "页面状态", exact: true });
          const stateDisplay = states.locator(".ui-card").first();
          await expect(stateDisplay.getByText("这里是今日的内容。", { exact: true })).toBeVisible();
          const previous = STATES[index - 1];
          if (previous !== undefined) await stateOptions.getByRole("radio", { name: previous.label, exact: true }).click();
          const option = stateOptions.getByRole("radio", { name: state.label, exact: true });
          await option.click();
          await expect(option).toBeChecked();
          await expect(stateDisplay.locator(`.ui-state--${state.code}`)).toBeVisible();
          if (state.code === "error") {
            await expect(stateDisplay.getByRole("alert")).toContainText("今日没能加载");
            await expect(stateDisplay.getByRole("button", { name: "重试", exact: true })).toBeVisible();
          }
          await expectNoHorizontalOverflow(page);
        });
      }

      componentTest("页面切换与键盘操作可用", async ({ componentPage: page }) => {
        const states = page.locator("#states");
        const stateOptions = states.getByRole("radiogroup", { name: "页面状态", exact: true });
        const stateDisplay = states.locator(".ui-card").first();
        await stateOptions.getByRole("radio", { name: "锁定", exact: true }).click();
        await states.getByRole("radiogroup", { name: "页面", exact: true }).getByRole("radio", { name: "知识点主页" }).click();
        await stateOptions.getByRole("radio", { name: "空", exact: true }).click();
        await expect(stateDisplay.getByRole("heading", { name: "这个知识点还没有内容" })).toBeVisible();
        const normal = stateOptions.getByRole("radio", { name: "正常", exact: true });
        await normal.focus();
        await page.keyboard.press("ArrowRight");
        await expect(stateOptions.getByRole("radio", { name: "加载", exact: true })).toBeFocused();
        await expect(stateDisplay.locator(".ui-state--loading")).toBeVisible();
      });

      componentTest("提议确认后可以撤销", async ({ componentPage: page }) => {
        const proposal = page.locator("#proposal .ui-proposal").first();
        await proposal.getByRole("button", { name: "确认", exact: true }).click();
        await expect(proposal.getByText("已确认", { exact: true })).toBeVisible();
        await proposal.getByRole("button", { name: "撤销", exact: true }).click();
        await expect(proposal.getByText("已撤销", { exact: true })).toBeVisible();
        await expect(proposal.getByRole("button")).toHaveCount(0);
      });

      componentTest("对话框关闭后恢复焦点", async ({ componentPage: page }) => {
        const openDialog = page.getByRole("button", { name: "打开对话框", exact: true });
        await openDialog.click();
        const dialog = page.getByRole("dialog", { name: "加入今日", exact: true });
        await expect(dialog).toBeVisible();
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(openDialog).toBeFocused();
      });

      componentTest("底部面板关闭后恢复焦点", async ({ componentPage: page }) => {
        const openSheet = page.getByRole("button", { name: "打开底部面板", exact: true });
        await openSheet.click();
        const sheet = page.getByRole("dialog", { name: "问导师", exact: true });
        await expect(sheet).toBeVisible();
        await sheet.getByRole("button", { name: "关闭", exact: true }).click();
        await expect(sheet).not.toBeVisible();
        await expect(openSheet).toBeFocused();
      });

      componentTest("字号与配色设置可用", async ({ componentPage: page }) => {
        const display = page.getByRole("group", { name: "显示设置", exact: true });
        await display.getByRole("button", { name: "大字号", exact: true }).click();
        await display.getByRole("button", { name: "色觉友好配色", exact: true }).click();
        await expect(page.locator("html")).toHaveAttribute("data-text", "large");
        await expect(page.locator("html")).toHaveAttribute("data-vision", "cvd");
        await expectNoHorizontalOverflow(page);
      });
    });
  }
});

// ───────── 页面画廊（F06 验收 2）：全部页面默认视图在 375 与 1280 两档截图，存进 .bk/gallery/<时间>/，并与上一次比对 ─────────
// 截完由 tools/gallery.mjs 逐点比对：画面变化超过阈值的页面写进 .bk/gallery/changes.json，并生成 .bk/gallery/index.html（上一次、这一次、差异并排）。
// 只在 Chromium 里跑（playwright.config.ts）；页面里的时间固定、动效关掉、演示考试固定为 kj：同一份代码两次截图应当一模一样。

const GALLERY_ROOT = join(ROOT, ".bk", "gallery");
const GALLERY_VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
] as const;
/** 截图时页面里的“现在”：固定下来，倒计时这类随日期变的内容才不会每天都算“有变化”。 */
const GALLERY_NOW = new Date("2026-10-21T09:00:00+08:00");
const GALLERY_EXAM = "kj";
/**
 * 同时开几个标签页截图。页面画廊与原有的组件陈列页测试一起在 pnpm gallery 里跑：四个标签页连续打开 70 页会占满开发服务器与机器，
 * 第 1 轮本地完整验证里同时跑的原有组件测试因此 2 项失败、5 项重试才过（单独跑原有测试全过）。只开一个，和别的测试一样一次打开一页。
 */
const GALLERY_TABS = 1;
/** 正文区的内容比窗口高时，把窗口拉高到放得下全部内容再截，最多拉到这么高。 */
const GALLERY_MAX_HEIGHT = 8000;
/** 同一秒里开了好几次画廊时，目录名后面加 -2、-3……最多试这么多次。 */
const GALLERY_NAME_TRIES = 50;

type Viewport = (typeof GALLERY_VIEWPORTS)[number];

interface GalleryShot {
  readonly width: number;
  readonly file?: string;
  readonly error?: string;
}

interface GalleryJob {
  readonly entry: PageEntry;
  readonly shots: GalleryShot[];
}

/** tools/gallery.mjs 写出的 changes.json 里逐张列出的问题：这一次没截到（failed），或没法和上一次比对（error）。 */
interface GalleryProblem {
  readonly app: AppKey;
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly status: "failed" | "error";
  readonly error: string;
}

interface GalleryChanges {
  readonly problems: readonly GalleryProblem[];
}

const PROBLEM_NAMES: Readonly<Record<GalleryProblem["status"], string>> = { failed: "没能截图", error: "没法和上一次比对" };

function describeGalleryProblem(problem: GalleryProblem): string {
  return `${APP_NAMES[problem.app]} ${problem.id} ${problem.name}（${problem.width}）${PROBLEM_NAMES[problem.status]}：${problem.error}`;
}

function galleryRunName(date: Date): string {
  const two = (value: number): string => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
  return `${day}_${two(date.getHours())}-${two(date.getMinutes())}-${two(date.getSeconds())}`;
}

/** 建这一次的目录 .bk/gallery/<年-月-日_时-分-秒>/，返回目录名。 */
async function createGalleryRun(): Promise<string> {
  await mkdir(GALLERY_ROOT, { recursive: true });
  const base = galleryRunName(new Date());
  for (let attempt = 1; attempt <= GALLERY_NAME_TRIES; attempt += 1) {
    const name = attempt === 1 ? base : `${base}-${attempt}`;
    try {
      await mkdir(join(GALLERY_ROOT, name));
      return name;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new Error(`.bk/gallery 里以 ${base} 开头的目录太多了`);
}

/** 学员端的外壳是“正文区自己滚动”：内容比窗口高时把窗口拉高，截下全部内容。 */
async function fitToContent(page: Page, viewport: Viewport): Promise<void> {
  const overflow = await page.evaluate(() => {
    const main = document.querySelector("main#main");
    return main === null ? 0 : Math.max(0, main.scrollHeight - main.clientHeight);
  });
  if (overflow === 0) return;
  await page.setViewportSize({ width: viewport.width, height: Math.min(viewport.height + overflow, GALLERY_MAX_HEIGHT) });
  await settle(page);
}

async function captureShot(page: Page, entry: PageEntry, viewport: Viewport, file: string): Promise<void> {
  await page.setViewportSize(viewport);
  const url = urlOf(entry, entry.app === "learner" ? { exam: GALLERY_EXAM } : {});
  // 与冒烟同样的打开判定与就绪等待：回应要成功（缓存仍然有效的 304 也算），再等外壳正文区出现（有上限）
  const problem = navigationProblem(await page.goto(url), url);
  if (problem !== null) throw new Error(problem);
  await waitForAppReady(page);
  await expectOpened(page, entry, entry.views[0]);
  await expectLoaded(page, entry);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await fitToContent(page, viewport);
  await page.screenshot({ path: file, fullPage: true, scale: "css", animations: "disabled", caret: "hide" });
}

test.describe("页面画廊：全部页面默认视图两档截图，与上一次比对", () => {
  // 重跑会和刚截的那次比，结果没有意义；整套 140 张截图给足时间
  test.describe.configure({ retries: 0, timeout: 30 * 60_000 });

  test("截图、与上一次比对、生成 index.html", { tag: PAGE_GALLERY_TAG }, async ({ browser }, testInfo) => {
    const run = await createGalleryRun();
    const started = new Date();
    const jobs: GalleryJob[] = ALL_PAGES.map((entry) => ({ entry, shots: [] }));
    for (const app of new Set(ALL_PAGES.map((entry) => entry.app))) await mkdir(join(GALLERY_ROOT, run, app), { recursive: true });

    for (const viewport of GALLERY_VIEWPORTS) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
      await context.clock.setFixedTime(GALLERY_NOW);
      const queue = [...jobs];
      const lane = async (): Promise<void> => {
        const page = await context.newPage();
        await installActivityMarker(page);
        for (let job = queue.shift(); job !== undefined; job = queue.shift()) {
          const file = `${job.entry.app}/${job.entry.id}-${viewport.width}.png`;
          try {
            await captureShot(page, job.entry, viewport, join(GALLERY_ROOT, run, file));
            job.shots.push({ width: viewport.width, file });
          } catch (error) {
            job.shots.push({ width: viewport.width, error: firstLine(error) });
          }
        }
        await page.close();
      };
      await Promise.all(Array.from({ length: GALLERY_TABS }, lane));
      await context.close();
    }

    const manifest = {
      version: 1,
      run,
      started: started.toISOString(),
      finished: new Date().toISOString(),
      browser: `${browser.browserType().name()} ${browser.version()}`,
      now: GALLERY_NOW.toISOString(),
      exam: GALLERY_EXAM,
      widths: GALLERY_VIEWPORTS.map((viewport) => viewport.width),
      pages: jobs.map(({ entry, shots }) => ({ app: entry.app, id: entry.id, name: entry.name, path: entry.path, shots })),
    };
    await writeFile(join(GALLERY_ROOT, run, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

    const args = [join(ROOT, "tools", "gallery.mjs"), "--root", GALLERY_ROOT, "--run", run];
    const compare = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8" });
    await testInfo.attach("页面画廊比对结果", { body: `${compare.stdout}${compare.stderr}`, contentType: "text/plain" });
    // 按每张截图核对比对结果：哪一档没截到、哪一档没法和上一次比，都要报出来；画面变化只写进清单供人复核，不算失败
    const written = await readFile(join(GALLERY_ROOT, run, "changes.json"), "utf8").catch(() => null);
    expect(written, `tools/gallery.mjs 没写出这一次的 changes.json：${compare.stderr}`).not.toBeNull();
    const { problems } = JSON.parse(written ?? "{}") as GalleryChanges;
    expect(problems.map(describeGalleryProblem), "这些截图没能截到或没法和上一次比对（见 .bk/gallery/index.html）").toEqual([]);
    expect(compare.status, `tools/gallery.mjs 比对没完成：${compare.stderr}`).toBe(0);

    const failed: string[] = [];
    for (const { entry, shots } of jobs) {
      for (const shot of shots) if (shot.error !== undefined) failed.push(`${pageLabel(entry)}（${shot.width}）：${shot.error}`);
    }
    expect(failed, "这些页面没能截图（其余页面照常截图、比对，见 .bk/gallery/index.html）").toEqual([]);
  });
});
