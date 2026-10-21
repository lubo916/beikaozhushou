// 端到端测试的运行环境（F06）：接口与三端的端口和地址、仓库根目录、页面画廊的标签。playwright.config.ts 与各测试共用这一份。
import { fileURLToPath } from "node:url";

/** 端口可用环境变量改：默认接口 3100，学员端、机构端、平台后台用开发端口 5173、5174、5175。 */
export const PORTS = {
  api: process.env["E2E_API_PORT"] || "3100",
  learner: process.env["E2E_LEARNER_PORT"] || "5173",
  org: process.env["E2E_ORG_PORT"] || "5174",
  admin: process.env["E2E_ADMIN_PORT"] || "5175",
} as const;

export type AppKey = "learner" | "org" | "admin";

export const APP_URLS: Readonly<Record<AppKey, string>> = {
  learner: `http://127.0.0.1:${PORTS.learner}`,
  org: `http://127.0.0.1:${PORTS.org}`,
  admin: `http://127.0.0.1:${PORTS.admin}`,
};

export const APP_NAMES: Readonly<Record<AppKey, string>> = { learner: "学员端", org: "机构端", admin: "平台后台" };

/** 仓库根目录（本文件在 tests/e2e/support/ 下）。 */
export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** 页面画廊的标签：只在 Chromium 项目里截图（playwright.config.ts 里 webkit、firefox 用 grepInvert 排除）。 */
export const PAGE_GALLERY_TAG = "@page-gallery";
