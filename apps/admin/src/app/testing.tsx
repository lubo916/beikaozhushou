// 外壳测试的小工具（浏览器模式，与机构端同一份）：用内存路由挂载，等按需加载的页面出来。
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { AppRoutes } from "../router/AppRoutes.tsx";
import { MemoryRouter } from "../router/history.tsx";
import "../i18n/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
  readonly host: HTMLElement;
  unmount: () => Promise<void>;
}

export async function mount(ui: ReactNode): Promise<Mounted> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(ui));
  return {
    host,
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

export function mountAt(path: string): Promise<Mounted> {
  return mount(
    <MemoryRouter initial={path}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

export async function settle(check: () => boolean, tries = 150): Promise<void> {
  for (let i = 0; i < tries && !check(); i += 1) {
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));
  }
}

export async function click(element: Element | null | undefined): Promise<void> {
  if (!(element instanceof HTMLElement)) throw new Error("找不到要点的元素");
  await act(async () => element.click());
}

export function heading(host: ParentNode): string | undefined {
  return host.querySelector("h1")?.textContent ?? undefined;
}

export function linkByText(root: ParentNode | null | undefined, text: string): HTMLAnchorElement | undefined {
  return [...(root?.querySelectorAll<HTMLAnchorElement>("a") ?? [])].find((link) => link.textContent?.trim() === text);
}
