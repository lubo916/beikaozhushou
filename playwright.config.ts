// Playwright（0.1b 计划 A6；F06 补三端与沙箱浏览器）：testDir 为 tests/e2e；webServer 起接口与三端（学员端、机构端、平台后台）；三个浏览器项目（网页沙箱只跑 Chromium）。
// 结果写 .test-results/playwright.json，可用 python3 scripts/engineering/test_results.py merge 合并进 results.json。截图基线只在固定版本的 Linux 镜像中生成与比对（tests/e2e/Dockerfile）。
// 有 BK_CHROMIUM 环境变量（bk 在网页沙箱里找到的自带 Chromium）时，Chromium 项目用它；本地照常用 playwright install 装的浏览器。
// 页面画廊（tests/e2e/gallery.spec.ts 里带 @page-gallery 标签的测试）只在 Chromium 里截图并与上一次比对；webkit、firefox 不跑这一条。
import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { APP_URLS, PAGE_GALLERY_TAG, PORTS, type AppKey } from "./tests/e2e/support/env.ts";
import { readPlaywrightShard } from "./tests/support/playwright-env.ts";

const CI = Boolean(process.env["CI"]);
// 网页沙箱（claude.ai，有 /mnt/user-data）只带 Chromium，在那里只跑 Chromium；本地与 CI 跑三个浏览器。E2E_BROWSERS 可显式指定（逗号分隔）。
const WEB_SANDBOX = existsSync("/mnt/user-data");
const BROWSERS = (process.env["E2E_BROWSERS"] || (WEB_SANDBOX ? "chromium" : "chromium,webkit,firefox")).split(",");
const WORKERS = process.env["E2E_WORKERS"];
const SHARD = readPlaywrightShard(process.env["E2E_SHARD"]);
const BK_CHROMIUM = process.env["BK_CHROMIUM"] || "";
const SANDBOX_CHROMIUM = BK_CHROMIUM !== "" && existsSync(BK_CHROMIUM) ? { launchOptions: { executablePath: BK_CHROMIUM } } : {};
const PAGE_GALLERY = new RegExp(PAGE_GALLERY_TAG);
const PROJECTS = [
  { name: "chromium", use: { ...devices["Desktop Chrome"], ...SANDBOX_CHROMIUM } },
  { name: "webkit", use: { ...devices["Desktop Safari"] }, grepInvert: PAGE_GALLERY },
  { name: "firefox", use: { ...devices["Desktop Firefox"] }, grepInvert: PAGE_GALLERY },
];

/** 一端的开发服务器：测试模式，假数据层开着（学员端），/api 转给本机接口。 */
function viteServer(app: AppKey) {
  return {
    command: `pnpm --filter @exam-prep/${app} exec vite --mode test --host 127.0.0.1 --port ${PORTS[app]} --strictPort`,
    url: APP_URLS[app],
    env: { API_PORT: PORTS.api },
    reuseExistingServer: !CI,
  };
}

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: ".test-results/playwright-artifacts",
  fullyParallel: true,
  ...(WORKERS ? { workers: Number(WORKERS) } : {}),
  ...(SHARD ? { shard: SHARD } : {}),
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: [["list"], ["json", { outputFile: ".test-results/playwright.json" }]],
  ignoreSnapshots: process.env["EXAM_PREP_SCREENSHOT_IMAGE"] !== "1",
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}",
  use: { baseURL: APP_URLS.learner, trace: "retain-on-failure" },
  projects: PROJECTS.filter((project) => BROWSERS.includes(project.name)),
  webServer: [
    {
      command: "node apps/api/src/main.ts",
      url: `http://127.0.0.1:${PORTS.api}/healthz`,
      env: { EXAM_PREP_ENV: "test", API_HOST: "127.0.0.1", API_PORT: PORTS.api, LOG_LEVEL: "warn" },
      reuseExistingServer: !CI,
    },
    viteServer("learner"),
    viteServer("org"),
    viteServer("admin"),
  ],
});
