import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { VOCAB } from "@exam-prep/shared/vocab";
import { Gallery } from "./Gallery.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement | undefined;
let root: Root | undefined;

async function render() {
  host = document.createElement("div");
  document.body.append(host);
  const created = createRoot(host);
  root = created;
  await act(async () => created.render(<Gallery />));
  return host;
}

async function click(element: Element | null | undefined) {
  if (!(element instanceof HTMLElement)) throw new Error("找不到要点的元素");
  await act(async () => element.click());
}

const find = (scope: ParentNode, selector: string, text: string) =>
  [...scope.querySelectorAll<HTMLElement>(selector)].find((element) => element.textContent?.trim() === text);

afterEach(async () => {
  const current = root;
  if (current) await act(async () => current.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

describe("组件陈列页 /dev/ui（浏览器模式）", () => {
  it("每个组件一节，目录能跳到每一节", async () => {
    const page = await render();
    const sections = [...page.querySelectorAll("section.dev-section")];
    const links = [...page.querySelectorAll<HTMLAnchorElement>(".dev-toc a")];
    expect(sections.length).toBeGreaterThan(20);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(sections.map((section) => `#${section.id}`));
    expect(page.querySelector("h1")?.textContent).toBe("公共组件陈列");
  });

  it("页面状态可以逐一切换，出错时给“重试”", async () => {
    const page = await render();
    const group = page.querySelector("[role=radiogroup][aria-label='页面状态']");
    await click(find(group ?? page, "[role=radio]", VOCAB.page_state.error));
    const states = page.querySelector("#states");
    expect(states?.querySelector(".ui-card [role=alert] h2")?.textContent).toBe("今日没能加载");
    await click(find(group ?? page, "[role=radio]", VOCAB.page_state.offline));
    expect(states?.querySelector(".ui-card .ui-state--offline")).not.toBeNull();
  });

  it("提议卡可以确认、撤销；显示设置切到大字号与色觉友好配色", async () => {
    const page = await render();
    const proposal = page.querySelector("#proposal .ui-proposal");
    await click(find(proposal ?? page, "button", "确认"));
    expect(proposal?.textContent).toContain("天内可撤销");
    await click(find(proposal ?? page, "button", "撤销"));
    expect(proposal?.querySelectorAll("button")).toHaveLength(0);
    await click(find(page, ".dev-gallery__bar button", "大字号"));
    await click(find(page, ".dev-gallery__bar button", "色觉友好配色"));
    expect(document.documentElement.getAttribute("data-text")).toBe("large");
    expect(document.documentElement.getAttribute("data-vision")).toBe("cvd");
  });
});
