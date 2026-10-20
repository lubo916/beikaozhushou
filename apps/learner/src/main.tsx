import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { queryClient } from "./api/query-client.ts";
import { App } from "./App.tsx";
import "./i18n/index.ts";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root mount element in index.html");

/** 开发与测试模式默认走假数据（api-rules 第 5 节，F04）；VITE_MOCKS=off 时关掉。正式构建不含假数据层。 */
async function enableMocks(): Promise<void> {
  if (!import.meta.env.DEV || import.meta.env["VITE_MOCKS"] === "off") return;
  const { startMocks } = await import("./mocks/index.ts");
  await startMocks({ queryClient });
}

function render(root: HTMLElement): void {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

// 假数据层启动失败也照常显示页面（工具条上会写原因）
void enableMocks()
  .catch(() => undefined)
  .then(() => render(container));
