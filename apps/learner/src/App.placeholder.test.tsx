import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import "./i18n/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("学员端占位页（浏览器模式）", () => {
  it("显示产品名“备考助手”与建设中的提示", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>,
      );
    });
    expect(host.textContent).toContain("备考助手");
    expect(host.textContent).toContain("页面正在建设中");
    await act(async () => root.unmount());
    host.remove();
  });
});
