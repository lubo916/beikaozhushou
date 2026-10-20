// 组件测试的小工具（浏览器模式，不引入 jsdom 与额外测试库）：挂载、点击、按键都走真实 DOM 事件。
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
  readonly host: HTMLElement;
  rerender: (ui: ReactNode) => Promise<void>;
  unmount: () => Promise<void>;
}

export async function mount(ui: ReactNode): Promise<Mounted> {
  const host = document.createElement("div");
  host.className = "ui-root ui-cq";
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(ui));
  return {
    host,
    rerender: (next) => act(async () => root.render(next)),
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

export async function click(element: Element | null | undefined): Promise<void> {
  if (!(element instanceof HTMLElement)) throw new Error("找不到要点的元素");
  await act(async () => element.click());
}

export async function press(element: Element | null | undefined, key: string): Promise<void> {
  if (!(element instanceof HTMLElement)) throw new Error("找不到要按键的元素");
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

export function byText(root: ParentNode, selector: string, text: string): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>(selector)].find((element) => element.textContent?.includes(text));
}
