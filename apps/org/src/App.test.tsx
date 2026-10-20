// 机构端外壳：侧栏 16 页、顶栏、分组抽屉、根路径跳首页、没有的地址、七态与“即将上线”的提示。
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { click, heading, linkByText, mount, mountAt, settle } from "./app/testing.tsx";

const nav = (host: ParentNode) => host.querySelector('nav[aria-label="主导航"]');

async function open(path: string, expected: string) {
  const mounted = await mountAt(path);
  await settle(() => heading(mounted.host) === expected);
  return mounted;
}

describe("机构端外壳（浏览器模式）", () => {
  it("机构工作台：侧栏按分组列出 16 页，当前页有标记，顶栏有端名与分组", async () => {
    const { host, unmount } = await open("/workbench", "机构工作台");
    const links = [...(nav(host)?.querySelectorAll("div.hidden > ul a") ?? [])];
    expect(links).toHaveLength(16);
    expect(linkByText(nav(host), "机构工作台")?.getAttribute("aria-current")).toBe("page");
    expect(linkByText(nav(host), "学员 360°")?.getAttribute("href")).toBe("/students/demo");
    expect(host.querySelector("header")?.textContent).toContain("机构端 · 总览");
    expect(host.textContent).toContain("开发中");
    expect(host.textContent).toContain("P0 必做：6 项");
    expect(host.textContent).toContain("python3 tools/bk.py proto O01");
    await unmount();
  });

  it("根路径跳首页；点侧栏链接换页；没有的地址显示“没有这个页面”", async () => {
    const { host, unmount } = await open("/", "机构工作台");
    await click(linkByText(nav(host), "督学预警"));
    await settle(() => heading(host) === "督学预警");
    expect(heading(host)).toBe("督学预警");
    await click(linkByText(nav(host), "学员 360°"));
    await settle(() => heading(host) === "学员 360°");
    expect(heading(host)).toBe("学员 360°");
    await unmount();
    const lost = await open("/nope", "没有这个页面");
    expect(linkByText(lost.host, "回到机构工作台")?.getAttribute("href")).toBe("/workbench");
    await lost.unmount();
  });

  it("手机的分组抽屉、平板图标栏的弹出层", async () => {
    const { host, unmount } = await open("/workbench", "机构工作台");
    await click(host.querySelector('button[aria-label="打开分组导航"]'));
    const drawer = [...host.querySelectorAll("dialog")].find((dialog) => dialog.textContent?.includes("全部页面"));
    expect(drawer?.open).toBe(true);
    expect(linkByText(drawer, "订阅与用量")).toBeDefined();
    const group = [...(nav(host)?.querySelectorAll("button[aria-expanded]") ?? [])][2];
    await click(group);
    expect(group?.getAttribute("aria-expanded")).toBe("true");
    await unmount();
  });

  it("还没有后端的按钮点了提示“即将上线”", async () => {
    const { host, unmount } = await open("/workbench", "机构工作台");
    await click(host.querySelector('button[aria-label="通知"]'));
    expect(host.querySelector('[role="status"]')?.textContent).toContain("即将上线");
    await unmount();
  });

  it("?state=error 显示机构端的出错写法", async () => {
    const { host, unmount } = await mountAt("/workbench?state=error");
    await settle(() => host.textContent?.includes("机构工作台没能加载") === true);
    expect(host.textContent).toContain("机构工作台没能加载");
    expect(host.textContent).toContain("服务暂时异常");
    await unmount();
  });

  it("App 用地址栏做路由：打开的地址决定页面，点链接改地址栏（测完把测试页地址还原）", async () => {
    const original = window.location.href;
    window.history.replaceState(null, "", "/alerts");
    try {
      const { host, unmount } = await mount(<App />);
      await settle(() => heading(host) === "督学预警");
      expect(heading(host)).toBe("督学预警");
      await click(linkByText(nav(host), "批改工作台"));
      await settle(() => heading(host) === "批改工作台");
      expect(window.location.pathname).toBe("/grading");
      await unmount();
    } finally {
      window.history.replaceState(null, "", original);
    }
  });
});
