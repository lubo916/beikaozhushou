// 学员端外壳：四种页面模式、导航三形态的结构、顶栏、导师浮标与面板、七态与没有的地址。
// 断点只靠样式（容器查询），这里查结构与跳转；三档宽度的外观由截图检查（F06 画廊）。
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import { App } from "../App.tsx";
import { PAGE_BY_ID } from "../router/pages.ts";
import { DevViewBar } from "./DevViewBar.tsx";
import { NO_GOAL_CONTEXT, click, heading, linkByText, mount, mountAt, settle } from "./testing.tsx";

const nav = (host: ParentNode) => host.querySelector('nav[aria-label="主导航"]');
const tabs = (host: ParentNode) => host.querySelector('nav[aria-label="底部标签"]');
const fab = (host: ParentNode) =>
  [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("问导师") && button.className.includes("absolute"));

async function open(path: string, expected?: string, context?: Parameters<typeof mountAt>[2]) {
  const mounted = await mountAt(path, <App />, context);
  await settle(() => (expected === undefined ? heading(mounted.host) !== undefined : heading(mounted.host) === expected));
  return mounted;
}

describe("标准页外壳", () => {
  it("今日：侧栏分组、底部五个标签、顶栏与空壳内容", async () => {
    const { host, unmount } = await open("/today", "今日");
    expect(heading(host)).toBe("今日");
    const main = nav(host);
    for (const name of ["今日", "学习计划", "知识地图", "复习与卡片", "错题本", "模考中心", "AI 导师", "消息与帮助"]) {
      expect(linkByText(main, name)).toBeDefined();
    }
    expect(linkByText(main, "今日")?.getAttribute("aria-current")).toBe("page");
    expect(main?.textContent).toContain("备考助手");
    expect(main?.textContent).toContain("陈然");
    // 入门已走完（有目标）：入门分组不出现；扩展包页面不进导航
    expect(linkByText(main, "备考目标")).toBeUndefined();
    expect(linkByText(main, "口头表达训练")).toBeUndefined();
    const tabLinks = [...(tabs(host)?.querySelectorAll("a") ?? [])];
    expect(tabLinks.map((link) => link.textContent)).toEqual(["今今日", "学学习", "练练测", "导导师", "我我的"]);
    expect(tabLinks.map((link) => link.getAttribute("href"))).toEqual(["/today", "/map", "/practice", "/tutor", "/growth"]);
    expect(host.querySelector('a[aria-label="搜索与速查"]')?.getAttribute("href")).toBe("/search");
    expect(host.querySelector('a[aria-label="消息与通知"]')?.getAttribute("href")).toBe("/messages");
    const goal = host.querySelector('a[href="/goals"]');
    expect(goal?.textContent).toBe("初级会计217 天");
    expect(host.textContent).toContain("开发中");
    expect(host.textContent).toContain("P0 必做：19 项");
    expect(host.textContent).toContain("python3 tools/bk.py proto S06 --views");
    await unmount();
  });

  it("还没有目标时显示入门分组与“先定目标”", async () => {
    const { host, unmount } = await open("/today", "今日", NO_GOAL_CONTEXT);
    expect(linkByText(nav(host), "备考目标")).toBeDefined();
    expect(linkByText(host, "先定目标")?.getAttribute("href")).toBe("/goals");
    await unmount();
  });

  it("点侧栏链接换页，标签跟着换", async () => {
    const { host, unmount } = await open("/today", "今日");
    await click(linkByText(nav(host), "错题本"));
    await settle(() => heading(host) === "错题本");
    expect(heading(host)).toBe("错题本");
    expect(tabs(host)?.querySelector('a[href="/practice"]')?.className).toContain("font-bold");
    await unmount();
  });

  it("平板图标栏：点分组字标弹出这一组的页面", async () => {
    const { host, unmount } = await open("/today", "今日");
    const learn = [...(nav(host)?.querySelectorAll("button[aria-expanded]") ?? [])].find((button) => button.textContent === "学学");
    expect(learn?.getAttribute("aria-expanded")).toBe("false");
    await click(learn);
    expect(learn?.getAttribute("aria-expanded")).toBe("true");
    expect(nav(host)?.querySelectorAll('a[href="/notes"]')).toHaveLength(2);
    await unmount();
  });

  it("手机：顶栏按钮打开分组抽屉", async () => {
    const { host, unmount } = await open("/today", "今日");
    await click(host.querySelector('button[aria-label="打开分组导航"]'));
    const drawer = [...host.querySelectorAll("dialog")].find((dialog) => dialog.textContent?.includes("全部页面"));
    expect(drawer?.open).toBe(true);
    expect(linkByText(drawer, "背诵训练")).toBeDefined();
    await unmount();
  });

  it("问导师：浮标与顶栏按钮都打开导师面板，导师页本身不显示浮标", async () => {
    const { host, unmount } = await open("/today", "今日");
    await click(fab(host));
    const panel = [...host.querySelectorAll("dialog")].find((dialog) => dialog.textContent?.includes("打开导师页"));
    expect(panel?.open).toBe(true);
    expect(panel?.textContent).toContain("你正在看：今日");
    await unmount();
    const tutor = await open("/tutor", "AI 导师");
    expect(fab(tutor.host)).toBeUndefined();
    await tutor.unmount();
  });

  it("?state= 强制状态：出错态用页名", async () => {
    const { host, unmount } = await open("/today?state=error");
    await settle(() => host.textContent?.includes("今日没能加载") === true);
    expect(host.textContent).toContain("今日没能加载");
    expect(host.textContent).not.toContain("原型里的功能点");
    await unmount();
  });

  it("根路径跳今日；没有的地址显示“没有这个页面”", async () => {
    const root = await open("/", "今日");
    expect(heading(root.host)).toBe("今日");
    await root.unmount();
    const lost = await open("/nope", "没有这个页面");
    expect(linkByText(lost.host, "回到今日")?.getAttribute("href")).toBe("/today");
    await lost.unmount();
  });

  it("扩展包页面不在导航里，但地址能打开", async () => {
    const { host, unmount } = await open("/oral", "口头表达训练");
    expect(host.textContent).toContain("扩展包");
    await unmount();
  });
});

describe("引导页、沉浸页、独立页", () => {
  it("备考目标首次进入是引导页：步骤条五步、只有上一步与跳过、没有导航", async () => {
    const { host, unmount } = await open("/goals", "备考目标");
    const steps = [...host.querySelectorAll('ol[aria-label="入门步骤"] li')];
    expect(steps.map((step) => step.textContent)).toEqual(["1 欢迎", "2 备考目标", "3 时间与资料", "4 摸底", "5 起点报告"]);
    expect(host.querySelector('[aria-current="step"]')?.textContent).toBe("2 备考目标");
    expect(linkByText(host, "上一步")?.getAttribute("href")).toBe("/welcome");
    expect(linkByText(host, "跳过")?.getAttribute("href")).toBe("/setup");
    expect(nav(host)).toBeNull();
    expect(tabs(host)).toBeNull();
    expect(fab(host)).toBeUndefined();
    await unmount();
  });

  it("?view=manage 时备考目标回到标准页", async () => {
    const { host, unmount } = await open("/goals?view=manage", "备考目标");
    expect(nav(host)).not.toBeNull();
    expect(host.querySelector('ol[aria-label="入门步骤"]')).toBeNull();
    await unmount();
  });

  it("阅读器是沉浸页：没有导航，只有退出，导师浮标还在", async () => {
    const { host, unmount } = await open("/reader/demo", "阅读器");
    expect(nav(host)).toBeNull();
    expect(tabs(host)).toBeNull();
    expect([...(host.querySelector("header")?.querySelectorAll("button") ?? [])].map((button) => button.textContent)).toEqual(["退出"]);
    expect(fab(host)).toBeDefined();
    await unmount();
  });

  it("摸底测评中与模考作答中不显示导师浮标", async () => {
    for (const [path, name] of [
      ["/diagnosis?view=test", "摸底诊断"],
      ["/mock?view=exam", "模考中心"],
    ] as const) {
      const { host, unmount } = await open(path, name);
      expect(nav(host)).toBeNull();
      expect(fab(host)).toBeUndefined();
      await unmount();
    }
  });

  it("欢迎与登录是独立页：只有标志，直接打开时没有“返回”", async () => {
    const { host, unmount } = await open("/welcome", "欢迎与登录");
    const header = host.querySelector("header");
    expect(header?.textContent).toBe("备考助手");
    expect(nav(host)).toBeNull();
    expect(fab(host)).toBeUndefined();
    await unmount();
  });
});

describe("开发用的切视图条", () => {
  it("列出本页的视图，当前视图有标记，链接只改 ?view=", async () => {
    const page = PAGE_BY_ID.S06;
    const { host, unmount } = await mount(
      <MemoryRouter initialEntries={["/today?exam=kj"]}>
        <DevViewBar page={page} view={page.views[2]} visible />
      </MemoryRouter>,
    );
    const links = [...host.querySelectorAll("a")];
    expect(links).toHaveLength(6);
    expect(links[2]?.getAttribute("href")).toBe("/today?exam=kj&view=done");
    expect(links[2]?.getAttribute("aria-current")).toBe("true");
    expect(links[2]?.textContent).toBe("done 全部完成");
    await unmount();
  });

  it("没有多视图的页面只说明一句；默认不显示（自动化测试与正式版本）", async () => {
    const { host, unmount } = await mount(
      <MemoryRouter initialEntries={["/plan"]}>
        <DevViewBar page={PAGE_BY_ID.S07} view={undefined} visible />
        <DevViewBar page={PAGE_BY_ID.S06} view={undefined} />
      </MemoryRouter>,
    );
    expect(host.querySelectorAll("aside")).toHaveLength(1);
    expect(host.textContent).toContain("本页只有一个视图");
    await unmount();
  });
});
