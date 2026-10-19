import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import "./i18n/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("占位应用（浏览器模式）", () => {
  it("只显示“尚未开放”", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<App />));
    expect(host.textContent).toBe("尚未开放");
    await act(async () => root.unmount());
    host.remove();
  });
});
