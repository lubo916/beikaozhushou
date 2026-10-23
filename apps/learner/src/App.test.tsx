import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import { heading, linkByText, mountAt, settle, stubDemoApi } from "./app/testing.tsx";

afterEach(() => vi.unstubAllGlobals());

describe("学员端外壳（浏览器模式）", () => {
  it("深链接 /today 打开外壳里的今日页", async () => {
    stubDemoApi("/today");
    const { host, unmount } = await mountAt("/today", <App />);
    await settle(() => heading(host) === "今日");
    expect(heading(host)).toBe("今日");
    expect(linkByText(host.querySelector('nav[aria-label="主导航"]'), "今日")?.getAttribute("aria-current")).toBe("page");
    expect(host.textContent).toContain("今日清单");
    await unmount();
  });
});
