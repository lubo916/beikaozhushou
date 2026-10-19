import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** 构建模式即环境名（vite build --mode staging）：只接受 EXAM_PREP_ENV 的四个取值（packages/domains/platform）。 */
const ENV_NAMES = ["development", "test", "staging", "production"];
const DEFAULT_API_PORT = "3000";

export default defineConfig(({ mode }) => {
  if (!ENV_NAMES.includes(mode)) {
    throw new Error(`构建模式 ${mode} 不是登记的环境名（${ENV_NAMES.join("、")}）`);
  }
  // 本机开发与预览：/api 转给本机 API（线上由 Caddy 转发，ADR-026 决定 6）
  const api = { target: `http://127.0.0.1:${process.env["API_PORT"] || DEFAULT_API_PORT}`, changeOrigin: false };
  return {
    plugins: [react(), tailwindcss()],
    server: { proxy: { "/api": api } },
    preview: { proxy: { "/api": api } },
    // 浏览器下限 Safari 16.4、Chrome 111、Firefox 128（ADR-029 决定 1）
    build: { target: ["safari16.4", "chrome111", "firefox128"], sourcemap: true },
  };
});
