// 平台后台外壳：侧栏 19 页、顶栏的环境标识、分组抽屉、根路径跳首页、没有的地址、七态与“即将上线”的提示。
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { click, heading, linkByText, mount, mountAt, settle } from "./app/testing.tsx";

const nav = (host: ParentNode) => host.querySelector('nav[aria-label="主导航"]');

async function open(path: string, expected: string) {
  const mounted = await mountAt(path);
  await settle(() => heading(mounted.host) === expected);
  return mounted;
}

describe("平台后台外壳（浏览器模式）", () => {
  it("运营驾驶舱：侧栏按分组列出 19 页，顶栏有端名、分组与当前环境", async () => {
    const { host, unmount } = await open("/cockpit", "运营驾驶舱");
    const links = [...(nav(host)?.querySelectorAll("div.hidden > ul a") ?? [])];
    expect(links).toHaveLength(19);
    expect(linkByText(nav(host), "运营驾驶舱")?.getAttribute("aria-current")).toBe("page");
    expect(linkByText(nav(host), "AI 执行者与提示词")?.getAttribute("href")).toBe("/ai-actors");
    const header = host.querySelector("header");
    expect(header?.textContent).toContain("平台后台 · 总览与数据");
    expect(header?.textContent).toContain("测试环境");
    expect(host.textContent).toContain("P0 必做：4 项");
    expect(host.textContent).toContain("python3 tools/bk.py proto P01");
    await unmount();
  });

  it("根路径跳首页；点侧栏链接换页；没有的地址显示“没有这个页面”", async () => {
    const { host, unmount } = await open("/", "运营驾驶舱");
    await click(linkByText(nav(host), "合规中心"));
    await settle(() => heading(host) === "合规中心");
    expect(heading(host)).toBe("合规中心");
    await unmount();
    const lost = await open("/nope", "没有这个页面");
    expect(linkByText(lost.host, "回到运营驾驶舱")?.getAttribute("href")).toBe("/cockpit");
    await lost.unmount();
  });

  it("手机的分组抽屉；还没有后端的按钮点了提示“即将上线”", async () => {
    const { host, unmount } = await open("/cockpit", "运营驾驶舱");
    await click(host.querySelector('button[aria-label="打开分组导航"]'));
    const drawer = [...host.querySelectorAll("dialog")].find((dialog) => dialog.textContent?.includes("全部页面"));
    expect(drawer?.open).toBe(true);
    expect(linkByText(drawer, "系统、参数与权限")).toBeDefined();
    await click(host.querySelector('button[aria-label="退出登录"]'));
    expect(host.querySelector('[role="status"]')?.textContent).toContain("即将上线");
    await unmount();
  });

  it("?state=restricted 显示受限态", async () => {
    const { host, unmount } = await mountAt("/users?state=restricted");
    await settle(() => host.textContent?.includes("这部分暂时用不了") === true);
    expect(host.textContent).toContain("这部分暂时用不了");
    await unmount();
  });

  it("App 用地址栏做路由：打开的地址决定页面，点链接改地址栏（测完把测试页地址还原）", async () => {
    const original = window.location.href;
    window.history.replaceState(null, "", "/safety");
    try {
      const { host, unmount } = await mount(<App />);
      await settle(() => heading(host) === "内容安全、社区与危机响应");
      expect(heading(host)).toBe("内容安全、社区与危机响应");
      await click(linkByText(nav(host), "合规中心"));
      await settle(() => heading(host) === "合规中心");
      expect(window.location.pathname).toBe("/compliance");
      await unmount();
    } finally {
      window.history.replaceState(null, "", original);
    }
  });
});
