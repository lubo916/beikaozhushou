import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { MASTERY_RANKS, masteryLabel } from "@exam-prep/shared/vocab";
import { byText, click, mount, press, type Mounted } from "../testing.tsx";
import { AiBadge, AiContent, ReasonTags } from "./Ai.tsx";
import { EvidenceRow, Importance, KpCard } from "./Knowledge.tsx";
import { MasteryGrid, MasteryLadder } from "./Mastery.tsx";
import { ProposalCard, TaskGroup, TaskStrip, UndoBar } from "./Plan.tsx";

let view: Mounted | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
});

describe("业务公共组件", () => {
  it("掌握阶梯（完整）：六档叫法来自词汇常量，标出系统判定、自评与目标，差几档用接口给的值", async () => {
    view = await mount(<MasteryLadder system={2} self={3} target={4} gap={2} />);
    const labels = [...view.host.querySelectorAll(".ui-ladder__label")].map((el) => el.textContent);
    expect(labels).toEqual(MASTERY_RANKS.map((rank) => masteryLabel(rank)));
    expect(view.host.querySelector("[data-rank='2'] .ui-ladder__mark--system")).not.toBeNull();
    expect(view.host.querySelector("[data-rank='3'] .ui-ladder__mark--self")).not.toBeNull();
    expect(view.host.querySelector("[data-rank='4'] .ui-ladder__mark--target")).not.toBeNull();
    expect(view.host.querySelector(".ui-ladder__gap")?.textContent).toBe("还差 2 档");
    await view.rerender(<MasteryLadder system={4} target={4} gap={0} evidenceSufficient={false} />);
    expect(view.host.querySelector(".ui-ladder__gap")?.textContent).toBe("已达标");
    expect(view.host.textContent).toContain("证据不足，不等于不会");
  });

  it("掌握阶梯：可改目标档；迷你版有完整的读屏说明", async () => {
    const onTargetChange = vi.fn();
    view = await mount(<MasteryLadder system={1} target={3} gap={2} onTargetChange={onTargetChange} />);
    await click(byText(view.host, "[role=radio]", masteryLabel(4)));
    expect(onTargetChange).toHaveBeenCalledWith(4);
    await view.rerender(<MasteryLadder variant="mini" system={1} target={3} gap={2} evidenceSufficient={false} />);
    const img = view.host.querySelector("[role=img]");
    expect(img?.getAttribute("aria-label")).toBe("系统判定：已了解；目标：已掌握；还差 2 档；证据不足，不等于不会");
    expect(view.host.querySelectorAll(".ui-ladder-mini__seg--on")).toHaveLength(2);
  });

  it("掌握方格：证据不足与范围外有文字说明（颜色不是唯一信息），方向键在格子间移动", async () => {
    const onSelect = vi.fn();
    const cells = [
      { id: "a", name: "会计等式", level: 3 as const },
      { id: "b", name: "资产", level: 0 as const, evidenceSufficient: false },
      { id: "c", name: "外币折算", level: 1 as const, inScope: false },
    ];
    view = await mount(<MasteryGrid label="第一章" cells={cells} onSelect={onSelect} />);
    const buttons = [...view.host.querySelectorAll<HTMLButtonElement>(".ui-grid__cells button")];
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "会计等式：已掌握",
      "资产：证据不足，不等于不会",
      "外币折算：范围外",
    ]);
    expect(buttons.map((b) => b.tabIndex)).toEqual([0, -1, -1]);
    buttons[0]?.focus();
    await press(buttons[0], "ArrowRight");
    expect(document.activeElement).toBe(buttons[1]);
    await click(buttons[2]);
    expect(onSelect).toHaveBeenCalledWith("c");
    expect(view.host.querySelectorAll(".ui-legend__item")).toHaveLength(8);
  });

  it("提议卡：固定四行；待确认只有“确认”“不改”；确认后可撤销并显示期限", async () => {
    const onConfirm = vi.fn();
    const onDecline = vi.fn();
    const onUndo = vi.fn();
    const props = { what: "把周六的新学挪到周日", why: "周六时间格只有 20 分钟", cost: "周日多学 25 分钟", ifNot: "周六的任务做不完" };
    view = await mount(<ProposalCard {...props} status="pending" aiGenerated onConfirm={onConfirm} onDecline={onDecline} />);
    expect([...view.host.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["改什么", "为什么", "代价", "不改会怎样"]);
    expect([...view.host.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["确认", "不改"]);
    expect(view.host.textContent).toContain("待确认");
    expect(view.host.textContent).toContain("AI 生成");
    await click(byText(view.host, "button", "确认"));
    await click(byText(view.host, "button", "不改"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
    await view.rerender(<ProposalCard {...props} status="confirmed" onUndo={onUndo} undoHint="7 天内可撤销" />);
    expect(view.host.textContent).toContain("已确认");
    await click(byText(view.host, "button", "撤销"));
    expect(onUndo).toHaveBeenCalledTimes(1);
    await view.rerender(<ProposalCard {...props} status="undone" />);
    expect(view.host.querySelectorAll("button")).toHaveLength(0);
    expect(view.host.textContent).toContain("已撤销");
  });

  it("AI 内容标识：显式标识；复制出去的文字带“【AI 生成】”", async () => {
    view = await mount(
      <>
        <AiContent note="导师生成">先复习会计等式</AiContent>
        <AiBadge size="xs" />
      </>,
    );
    expect(view.host.querySelectorAll(".ui-ai-badge")).toHaveLength(2);
    const body = view.host.querySelector(".ui-ai__body");
    const range = document.createRange();
    range.selectNodeContents(body as Node);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    const data = new DataTransfer();
    const event = new ClipboardEvent("copy", { clipboardData: data, bubbles: true, cancelable: true });
    await act(async () => {
      body?.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(data.getData("text/plain")).toBe("【AI 生成】先复习会计等式");
  });

  it("今日任务条与分段：来源叫法、用时格式、开始、完成与“看过”", async () => {
    const onStart = vi.fn();
    view = await mount(
      <TaskGroup segment="consolidate">
        <TaskStrip
          source="due_review"
          segment="consolidate"
          title="会计要素回忆卡"
          minutes={12}
          reasons={["今天到期", "考频 4 级"]}
          onStart={onStart}
        />
        <TaskStrip source="mistake_retry" title="错题：资产的确认" minutes={8} state="done" />
        <TaskStrip source="new_learning" title="第二章阅读" minutes={95} state="seen" />
      </TaskGroup>,
    );
    expect(view.host.querySelector("h3")?.textContent).toBe("巩固");
    expect(view.host.textContent).toContain("推迟就有损失");
    expect(view.host.textContent).toContain("到期复习");
    expect(view.host.textContent).toContain("12 分钟");
    expect(view.host.textContent).toContain("1 小时 35 分钟");
    await click(byText(view.host, "button", "开始"));
    expect(onStart).toHaveBeenCalledTimes(1);
    const states = [...view.host.querySelectorAll(".ui-task__state")].map((el) => el.textContent);
    expect(states).toEqual(["已完成", "看过"]);
  });

  it("知识点小卡、重要度、证据行、理由标签与撤销条", async () => {
    const onUndo = vi.fn();
    view = await mount(
      <>
        <KpCard
          name="会计等式"
          path="第一章 › 会计要素"
          system={2}
          target={3}
          gap={1}
          importance={3}
          types={["concept"]}
          scope="added"
          starred
          reasons={["还差 1 档"]}
          href="/kp/1"
        />
        <Importance level={2} />
        <ul>
          <EvidenceRow
            when="10月20日 14:05"
            title="单选第 3 题"
            result="correct"
            confidence="vague"
            strength="pending"
            credibility="reviewed"
            note="秒答，换个问法再考"
          />
        </ul>
        <ReasonTags reasons={["考频 4 级"]} aiPolished />
        <UndoBar message="已把 2 项顺延到明天" hint="7 天内可撤销" onUndo={onUndo} />
      </>,
    );
    expect(view.host.querySelector(".ui-kp a")?.getAttribute("href")).toBe("/kp/1");
    expect(view.host.textContent).toContain("概念原理型");
    expect(view.host.textContent).toContain("我加入");
    expect(view.host.querySelector(".ui-stars")?.getAttribute("aria-label")).toBe("重要度 3 级（共 4 级）");
    expect(view.host.textContent).toContain("模糊");
    expect(view.host.textContent).toContain("一级 审定");
    expect(view.host.textContent).toContain("待验证");
    expect(view.host.querySelector(".ui-reasons .ui-ai-badge")).not.toBeNull();
    await click(byText(view.host, ".ui-undo button", "撤销"));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
