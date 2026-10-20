import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { PAGE_STATE_CODES } from "@exam-prep/shared/vocab";
import { Button } from "../basic/Button.tsx";
import { pageStateFromSearch } from "../lib/page-state.ts";
import { click, mount, type Mounted } from "../testing.tsx";
import { PageState, PageStates } from "./PageState.tsx";

let view: Mounted | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("页面状态（七态）", () => {
  it("出错（学员端）：标题与正文按 ui-rules 的通用写法，带“重试”“反馈问题”", async () => {
    const onRetry = vi.fn();
    const onReport = vi.fn();
    view = await mount(<PageState state="error" pageName="今日" onRetry={onRetry} onReport={onReport} />);
    expect(view.host.querySelector("[role=alert]")).not.toBeNull();
    expect(view.host.querySelector("h2")?.textContent).toBe("今日没能加载");
    expect(view.host.textContent).toContain("今日的数据暂时没取到：网络或服务异常。已保存的内容不受影响，点“重试”即可；连续失败会自动上报。");
    const buttons = [...view.host.querySelectorAll("button")];
    expect(buttons.map((button) => button.textContent)).toEqual(["重试", "反馈问题"]);
    await click(buttons[0]);
    await click(buttons[1]);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onReport).toHaveBeenCalledTimes(1);
  });

  it("出错（机构端、平台后台）用另一种写法", async () => {
    view = await mount(<PageState state="error" pageName="班级看板" audience="staff" />);
    expect(view.host.textContent).toContain("服务暂时异常，已保存的内容不受影响；重试或稍后再来。");
  });

  it("加载：骨架占位加读屏提示，超过参数秒数再出慢速提示", async () => {
    view = await mount(<PageState state="loading" pageName="今日" slowHintAfterSeconds={0.05} />);
    expect(view.host.querySelector("[role=status]")?.textContent).toContain("正在加载今日");
    expect(view.host.querySelector(".ui-skel")).not.toBeNull();
    expect(view.host.querySelector(".ui-state__slow")).toBeNull();
    await act(async () => {
      await wait(120);
    });
    expect(view.host.querySelector(".ui-state__slow")).not.toBeNull();
  });

  it("空、离线、受限、锁定：文案可传入，动作可传入", async () => {
    view = await mount(
      <>
        <PageState state="empty" title="今天没有安排" body="目标日已过或还没生成计划" action={<Button>生成计划</Button>} />
        <PageState state="offline" />
        <PageState state="restricted" />
        <PageState state="locked" action={<Button>去修复</Button>} />
      </>,
    );
    const titles = [...view.host.querySelectorAll("h2")].map((h) => h.textContent);
    expect(titles).toEqual(["今天没有安排", "现在没有联网", "这部分暂时用不了", "这一块暂时锁定"]);
    expect(view.host.textContent).toContain("生成计划");
    expect(view.host.textContent).toContain("去修复");
  });

  it("数据不足：只给原始计数并说明还差什么", async () => {
    view = await mount(<PageState state="insufficient_data" counts={[{ key: "n", label: "已作答", value: "6 题" }]} missing="再做 4 题后给出结论" />);
    expect(view.host.querySelector("dt")?.textContent).toBe("已作答");
    expect(view.host.textContent).toContain("再做 4 题后给出结论");
  });

  it("正常态显示内容；?state= 只认登记的状态码，可关闭", async () => {
    view = await mount(<PageStates state="normal">正常内容</PageStates>);
    expect(view.host.textContent).toBe("正常内容");
    expect(pageStateFromSearch("?state=offline")).toBe("offline");
    expect(pageStateFromSearch("?state=bogus")).toBe("normal");
    expect(pageStateFromSearch("?state=locked", { allowed: PAGE_STATE_CODES.filter((code) => code !== "locked") })).toBe("normal");
    expect(pageStateFromSearch("?state=error", { enabled: false })).toBe("normal");
  });
});
