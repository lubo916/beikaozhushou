import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { mountAt, settle } from "./app/testing.tsx";

describe("学员端占位页（浏览器模式）", () => {
  it("根路径进今日的空壳：显示产品名“备考助手”与建设中的提示", async () => {
    const { host, unmount } = await mountAt("/", <App />);
    await settle(() => host.textContent?.includes("页面正在建设中") === true);
    expect(host.textContent).toContain("备考助手");
    expect(host.textContent).toContain("页面正在建设中");
    await unmount();
  });
});
