// 共用作答组件（U18a）：把握度三档无默认、没有“不会”；选择题揭晓后锁定并标出正确答案；题号导航念得出状态；提交条说清差哪一步。
import { describe, expect, it, vi } from "vitest";
import { click, mount } from "../testing.tsx";
import { AnswerInput, ConfidencePicker, QuestionNav, SubmitBar, emptyResponse, toggleOption } from "./index.ts";
import copy from "./copy.zh-CN.json";

const options = ["200", "201", "206", "207"];

describe("把握度（S18-04）", () => {
  it("三档、没有默认、没有“不会”；点了才选上", async () => {
    const onChange = vi.fn();
    const { host, unmount } = await mount(<ConfidencePicker value={null} onChange={onChange} />);
    const radios = [...host.querySelectorAll<HTMLInputElement>("input[type=radio]")];
    expect(radios).toHaveLength(3);
    expect(radios.some((radio) => radio.checked)).toBe(false);
    expect(host.textContent).not.toContain("不会");
    await click(radios[0]);
    expect(onChange).toHaveBeenCalledWith("sure");
    await unmount();
  });

  it("关了把握度：不显示选项，只说明做对最高记中证据", async () => {
    const { host, unmount } = await mount(<ConfidencePicker value={null} onChange={() => undefined} off />);
    expect(host.querySelectorAll("input")).toHaveLength(0);
    expect(host.textContent).toContain(copy.confidence.off);
    await unmount();
  });
});

describe("作答区（S18-01、S18-03）", () => {
  it("单选：点选项交出作答；揭晓后锁定，点了也不变，并标出正确答案与你选的", async () => {
    const onChange = vi.fn();
    const shape = { form: "choice" as const, options };
    const first = await mount(<AnswerInput {...shape} value={emptyResponse(shape)} onChange={onChange} />);
    await click(first.host.querySelectorAll("input")[1]);
    expect(onChange).toHaveBeenCalledWith({ selected: [1], texts: [] });
    await first.unmount();

    const locked = vi.fn();
    const chosen = toggleOption(emptyResponse(shape), 1, false);
    const second = await mount(<AnswerInput {...shape} value={chosen} onChange={locked} locked answer={[0]} />);
    const inputs = [...second.host.querySelectorAll<HTMLInputElement>("input")];
    expect(inputs.every((input) => input.disabled)).toBe(true);
    await click(inputs[2]);
    expect(locked).not.toHaveBeenCalled();
    expect(second.host.textContent).toContain(copy.choice.correct);
    expect(second.host.textContent).toContain(copy.choice.mine);
    await second.unmount();
  });

  it("填空：每个空一个输入框；排序：每项有上移、下移", async () => {
    const fillShape = { form: "fill" as const, parts: ["成本", "投资收益"] };
    const blanks = await mount(<AnswerInput {...fillShape} value={emptyResponse(fillShape)} onChange={() => undefined} />);
    expect(blanks.host.querySelectorAll("input[type=text]")).toHaveLength(2);
    await blanks.unmount();
    const orderShape = { form: "match_order" as const, options: ["一", "二", "三"] };
    const order = await mount(<AnswerInput {...orderShape} value={emptyResponse(orderShape)} onChange={() => undefined} />);
    expect(order.host.querySelectorAll("li")).toHaveLength(3);
    expect(order.host.textContent).toContain(copy.order.down);
    await order.unmount();
  });
});

describe("题号导航与提交条", () => {
  it("每题一个按钮，读屏念出第几题与状态，当前题标 aria-current", async () => {
    const onSelect = vi.fn();
    const items = [
      { key: "a", status: "correct" as const },
      { key: "b", status: "wrong" as const },
      { key: "c", status: "unanswered" as const, flagged: true },
    ];
    const { host, unmount } = await mount(<QuestionNav items={items} current={2} onSelect={onSelect} />);
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons).toHaveLength(3);
    expect(buttons[2]?.getAttribute("aria-current")).toBe("step");
    expect(buttons[1]?.getAttribute("aria-label")).toContain(copy.nav.status.wrong);
    await click(buttons[0]);
    expect(onSelect).toHaveBeenCalledWith(0);
    await unmount();
  });

  it("还没作答：提交按钮不可点并说明差哪一步；揭晓后换成“答案不能再改”", async () => {
    const waiting = await mount(<SubmitBar blocker="answer" onSubmit={() => undefined} />);
    expect(waiting.host.querySelector("button")?.disabled).toBe(true);
    expect(waiting.host.textContent).toContain(copy.submit.blocker.answer);
    await waiting.unmount();
    const done = await mount(<SubmitBar blocker={null} locked onSubmit={() => undefined} />);
    expect(done.host.querySelector("button")).toBeNull();
    expect(done.host.textContent).toContain(copy.submit.locked);
    await done.unmount();
  });
});
