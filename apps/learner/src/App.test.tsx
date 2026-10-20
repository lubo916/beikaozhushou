import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { heading, mountAt, settle } from "./app/testing.tsx";

describe("学员端外壳（浏览器模式）", () => {
  it("深链接 /today 打开外壳里的今日页", async () => {
    const { host, unmount } = await mountAt("/today", <App />);
    await settle(() => heading(host) === "今日");
    expect(heading(host)).toBe("今日");
    await unmount();
  });
});
