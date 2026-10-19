import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import "./i18n/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("学员端骨架（浏览器模式）", () => {
  it("任意路径都显示“学员端”", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/today"]}>
          <App />
        </MemoryRouter>,
      );
    });
    expect(host.querySelector("h1")?.textContent).toBe("学员端");
    await act(async () => root.unmount());
    host.remove();
  });
});
