// Vitest 4（0.1b 计划 A5）：projects 覆盖 apps、packages 与 tests。纯逻辑用 node 环境；数据库测试（*.db.test.ts）串行；
// 组件测试用浏览器模式（Playwright 驱动），不引入 jsdom。结果写 .test-results/vitest.json，由 verify 合并进 results.json。
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env");
} catch {
  // 没有 .env 时用进程环境（CI 与预发）
}

export default defineConfig({
  test: {
    reporters: ["default", "json"],
    outputFile: { json: ".test-results/vitest.json" },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["apps/{api,worker}/**/*.test.ts", "packages/**/*.test.ts", "tests/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/*.db.test.ts", "tests/e2e/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["apps/**/*.db.test.ts", "packages/**/*.db.test.ts"],
          exclude: ["**/node_modules/**"],
          fileParallelism: false,
          globalSetup: ["tests/setup/db-global-setup.ts"],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "browser",
          include: ["apps/{learner,org,admin}/src/**/*.test.tsx", "packages/ui/src/**/*.test.tsx"],
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: "chromium" }] },
        },
      },
    ],
  },
});
