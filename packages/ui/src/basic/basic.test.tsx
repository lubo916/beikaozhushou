import { afterEach, describe, expect, it, vi } from "vitest";
import { byText, click, mount, press, type Mounted } from "../testing.tsx";
import { Button, IconButton } from "./Button.tsx";
import { Card } from "./Card.tsx";
import { FilterChips, Segmented, Tabs } from "./Choice.tsx";
import { BarList, DataTable, KeyValueList, PageHeader, Stat } from "./Data.tsx";
import { Banner, ProgressBar, Skeleton } from "./Feedback.tsx";
import { List, ListRow } from "./ListRow.tsx";
import { Tag } from "./Tag.tsx";

let view: Mounted | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
});

describe("基础组件", () => {
  it("按钮：默认 type=button；进行中不可点并带 aria-busy", async () => {
    const onClick = vi.fn();
    view = await mount(
      <>
        <Button variant="primary" onClick={onClick}>
          开始
        </Button>
        <Button busy onClick={onClick}>
          保存
        </Button>
        <IconButton label="关闭" icon="close" />
      </>,
    );
    const [first, second, icon] = [...view.host.querySelectorAll("button")];
    expect(first?.getAttribute("type")).toBe("button");
    expect(first?.className).toContain("ui-btn--primary");
    await click(first);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(second?.disabled).toBe(true);
    expect(second?.getAttribute("aria-busy")).toBe("true");
    expect(icon?.getAttribute("aria-label")).toBe("关闭");
  });

  it("面板：标题与区域关联，动作和页脚都在", async () => {
    view = await mount(
      <Card title="三个数" meta="够不够" actions={<Button>详情</Button>} footer="口径说明" tone="sunk">
        内容
      </Card>,
    );
    const section = view.host.querySelector("section");
    const heading = view.host.querySelector("h2");
    expect(section?.getAttribute("aria-labelledby")).toBe(heading?.id);
    expect(view.host.textContent).toContain("够不够");
    expect(view.host.querySelector(".ui-card__foot")?.textContent).toBe("口径说明");
    expect(section?.className).toContain("ui-card--sunk");
  });

  it("标签与列表行：整行可点、链接行、独立按钮", async () => {
    const onSelect = vi.fn();
    view = await mount(
      <List>
        <ListRow title="会计要素" description="第一章" trailing={<Tag tone="brand">高频</Tag>} onSelect={onSelect} />
        <ListRow title="资产的确认" href="/kp/asset" current />
        <ListRow title="只读行" action={<Button size="sm">加入今日</Button>} />
      </List>,
    );
    await click(view.host.querySelector("li button"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    const link = view.host.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/kp/asset");
    expect(link?.getAttribute("aria-current")).toBe("page");
    expect(view.host.querySelectorAll("li")).toHaveLength(3);
  });

  it("分段选择：单选组语义，方向键移动并选中", async () => {
    const onChange = vi.fn();
    const options = [
      { value: "full", label: "完整" },
      { value: "lite", label: "精简" },
      { value: "min", label: "保底", disabled: true },
    ];
    view = await mount(<Segmented label="档位" options={options} value="full" onChange={onChange} />);
    const radios = [...view.host.querySelectorAll<HTMLElement>("[role=radio]")];
    expect(view.host.querySelector("[role=radiogroup]")?.getAttribute("aria-label")).toBe("档位");
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
    await press(radios[0], "ArrowRight");
    expect(onChange).toHaveBeenCalledWith("lite");
    await press(radios[0], "End");
    expect(onChange).toHaveBeenCalledWith("lite");
  });

  it("标签页：选中态、面板关联、方向键切换", async () => {
    const onChange = vi.fn();
    const items = [
      { key: "a", label: "题目" },
      { key: "b", label: "卡片", badge: 3 },
    ];
    view = await mount(
      <Tabs label="关联内容" items={items} value="a" onChange={onChange}>
        面板
      </Tabs>,
    );
    const tabs = [...view.host.querySelectorAll<HTMLElement>("[role=tab]")];
    const panel = view.host.querySelector("[role=tabpanel]");
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(panel?.getAttribute("aria-labelledby")).toBe(tabs[0]?.id);
    expect(tabs[0]?.getAttribute("aria-controls")).toBe(panel?.id);
    await press(tabs[0], "ArrowLeft");
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("筛选片：开关按钮，多选与单选", async () => {
    const onChange = vi.fn();
    const options = [
      { value: "wrong", label: "做错的", count: 12 },
      { value: "new", label: "没做过的" },
    ];
    view = await mount(<FilterChips label="筛选" options={options} selected={["wrong"]} onChange={onChange} />);
    const chips = [...view.host.querySelectorAll("button")];
    expect(chips[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(chips[0]?.textContent).toContain("12");
    await click(chips[1]);
    expect(onChange).toHaveBeenCalledWith(["wrong", "new"]);
    await click(chips[0]);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("进度条、统计数、键值行、页头、横条图与骨架", async () => {
    view = await mount(
      <>
        <PageHeader title="会计要素" eyebrow="第一章" actions={<Button>加入今日</Button>} meta={<Tag>概念原理型</Tag>} />
        <ProgressBar label="完成度" value={0.625} />
        <Stat label="完成度" question="走了多远" value="63" unit="%" />
        <KeyValueList items={[{ key: "a", label: "历年分值", value: "4 分" }]} />
        <BarList
          label="错因分布"
          items={[
            { key: "a", label: "概念没懂", value: 6, valueText: "6 次" },
            { key: "b", label: "审题失误", value: 3, valueText: "3 次" },
          ]}
        />
        <Skeleton lines={2} title />
      </>,
    );
    expect(view.host.querySelector("h1")?.textContent).toBe("会计要素");
    const bar = view.host.querySelector("[role=progressbar]");
    expect(bar?.getAttribute("aria-valuenow")).toBe("63");
    expect(bar?.getAttribute("aria-valuetext")).toBe("63%");
    expect(view.host.querySelector("dt")?.textContent).toBe("历年分值");
    const fills = [...view.host.querySelectorAll<HTMLElement>(".ui-bars__fill")].map((fill) => fill.style.width);
    expect(fills).toEqual(["100%", "50%"]);
    expect(view.host.querySelector(".ui-skel")?.getAttribute("aria-hidden")).toBe("true");
    expect(byText(view.host, ".ui-stat", "走了多远")).toBeDefined();
  });

  it("表格：表名、列头范围、空表文案", async () => {
    const columns = [
      { key: "name", header: "知识点", label: "知识点", render: (row: { name: string }) => row.name },
      { key: "n", header: "次数", align: "end" as const, render: () => "3" },
    ];
    view = await mount(
      <DataTable caption="关联题目" columns={columns} rows={[{ name: "会计等式" }]} rowKey={(row) => row.name} stackOnNarrow />,
    );
    expect(view.host.querySelector("caption")?.textContent).toBe("关联题目");
    expect(view.host.querySelector("th")?.getAttribute("scope")).toBe("col");
    expect(view.host.querySelector("td")?.getAttribute("data-label")).toBe("知识点");
    await view.rerender(<DataTable caption="关联题目" columns={columns} rows={[]} rowKey={() => ""} empty="没有数据" />);
    expect(view.host.querySelector("td")?.textContent).toBe("没有数据");
  });

  it("提示条：出错类立即念出，其余不打断", async () => {
    const onDismiss = vi.fn();
    view = await mount(
      <>
        <Banner tone="danger" title="没保存上" />
        <Banner tone="ai" onDismiss={onDismiss}>
          导师暂不可用
        </Banner>
      </>,
    );
    const [danger, info] = [...view.host.querySelectorAll(".ui-banner")];
    expect(danger?.getAttribute("role")).toBe("alert");
    expect(info?.getAttribute("role")).toBe("status");
    await click(info?.querySelector("button"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
