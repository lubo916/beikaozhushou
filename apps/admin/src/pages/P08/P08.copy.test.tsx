import { act } from "react";
import { describe, expect, it } from "vitest";
import { mount } from "../../app/testing.tsx";
import { p08Fixture } from "../../mocks/pages/P08.ts";
import { QualityChecksCard } from "./components/QualityChecksCard.tsx";
import { ReviewQueueCard } from "./components/ReviewQueueCard.tsx";

/** 模拟浏览器的原生复制事件；默认剪贴板先放选中文字，只有 AI 内容应拦截并补来源。 */
function stemElement(host: HTMLElement, stem: string) {
  const element = [...host.querySelectorAll<HTMLElement>("span")].find((candidate) => candidate.textContent === stem);
  if (element === undefined) throw new Error("找不到题干");
  return element;
}

async function copyStem(host: HTMLElement, stem: string) {
  const element = stemElement(host, stem);
  const selection = document.getSelection();
  if (selection === null) throw new Error("浏览器没有选区");
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
  try {
    const data = new DataTransfer();
    data.setData("text/plain", selection.toString());
    const event = new ClipboardEvent("copy", { clipboardData: data, bubbles: true, cancelable: true });
    await act(async () => {
      element.dispatchEvent(event);
    });
    return { text: data.getData("text/plain"), prevented: event.defaultPrevented };
  } finally {
    selection.removeAllRanges();
  }
}

describe("P08 题干的原生复制来源标识", () => {
  for (const scope of ["platform", "learner_instant"] as const) {
    it(`生成题质检 ${scope}：复制题干保留 AI 标识`, async () => {
      const check = p08Fixture().normal.checks[0];
      if (check === undefined) throw new Error("fixture 没有生成题质检");
      const { host, unmount } = await mount(<QualityChecksCard checks={[{ ...check, scope }]} />);
      try {
        const copied = await copyStem(host, check.stem);
        const expected = { text: `【AI 生成】${check.stem}`, prevented: true };
        expect(copied, `复制断言：expected=${JSON.stringify(expected)}; received=${JSON.stringify(copied)}`).toEqual(expected);
        expect(stemElement(host, check.stem).closest(".ui-ai")?.querySelector(".ui-ai-badge")?.textContent).toContain("AI 生成");
      } finally {
        await unmount();
      }
    });
  }

  for (const [credibility, generated] of [
    ["generated_confirmed", true],
    ["generated_instant", true],
    ["reviewed", false],
    ["own", false],
  ] as const) {
    it(`审核队列 ${credibility}：复制不丢来源、不误标普通题`, async () => {
      const fixture = p08Fixture().normal;
      const task = fixture.tasks[0];
      if (task === undefined) throw new Error("fixture 没有待审核题");
      const data = { ...fixture, tasks: [{ ...task, credibility }] };
      const { host, unmount } = await mount(
        <ReviewQueueCard data={data} origin="all" onOrigin={() => undefined} onSoon={() => undefined} />,
      );
      try {
        const copied = await copyStem(host, task.stem);
        const expected = {
          text: generated ? `【AI 生成】${task.stem}` : task.stem,
          prevented: generated,
        };
        expect(copied, `复制断言：expected=${JSON.stringify(expected)}; received=${JSON.stringify(copied)}`).toEqual(expected);
        if (generated) {
          expect(stemElement(host, task.stem).closest(".ui-ai")?.querySelector(".ui-ai-badge")?.textContent).toContain("AI 生成");
        } else {
          expect(stemElement(host, task.stem).closest(".ui-ai")).toBeNull();
          expect(host.querySelector(".ui-ai-badge")).toBeNull();
        }
      } finally {
        await unmount();
      }
    });
  }
});
