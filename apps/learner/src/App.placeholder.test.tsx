import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import { heading, linkByText, mountAt, settle, stubDemoApi } from "./app/testing.tsx";

afterEach(() => vi.unstubAllGlobals());

describe("学员端首页（浏览器模式）", () => {
  it("根路径跳转今日：显示产品名“备考助手”、真实今日页与当前导航", async () => {
    stubDemoApi("/");
    const { host, unmount } = await mountAt("/", <App />);
    await settle(() => heading(host) === "今日");
    expect(heading(host)).toBe("今日");
    expect(host.textContent).toContain("备考助手");
    expect(host.textContent).toContain("今日清单");
    expect(host.querySelector('section[aria-label="今天的安排"]')).not.toBeNull();
    expect(linkByText(host.querySelector('nav[aria-label="主导航"]'), "今日")?.getAttribute("aria-current")).toBe("page");
    await unmount();
  });
});
