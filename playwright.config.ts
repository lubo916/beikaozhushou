// Playwright（0.1b 计划 A6）：testDir 为 tests/e2e；webServer 同时起 api 与学员端；三个浏览器项目。
// 结果写 .test-results/playwright.json，由 verify 合并进 results.json。截图基线只在固定版本的 Linux 镜像中生成与比对（tests/e2e/Dockerfile）。
import { defineConfig, devices } from "@playwright/test";

const API_PORT = process.env["E2E_API_PORT"] || "3100";
const LEARNER_PORT = process.env["E2E_LEARNER_PORT"] || "5173";
const CI = Boolean(process.env["CI"]);

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: ".test-results/playwright-artifacts",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: [["list"], ["json", { outputFile: ".test-results/playwright.json" }]],
  ignoreSnapshots: process.env["EXAM_PREP_SCREENSHOT_IMAGE"] !== "1",
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}",
  use: { baseURL: `http://127.0.0.1:${LEARNER_PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: [
    {
      command: "node apps/api/src/main.ts",
      url: `http://127.0.0.1:${API_PORT}/healthz`,
      env: { EXAM_PREP_ENV: "test", API_HOST: "127.0.0.1", API_PORT, LOG_LEVEL: "warn" },
      reuseExistingServer: !CI,
    },
    {
      command: `pnpm --filter @exam-prep/learner exec vite --mode test --host 127.0.0.1 --port ${LEARNER_PORT} --strictPort`,
      url: `http://127.0.0.1:${LEARNER_PORT}`,
      env: { API_PORT },
      reuseExistingServer: !CI,
    },
  ],
});
