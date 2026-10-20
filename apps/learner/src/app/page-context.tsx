// 外壳交给页面的信息（F05）：当前是哪一页、哪个视图、什么模式。
// 真实使用时由数据决定视图：页面调用 setView(键)；地址里的 ?view= 只在开发与测试时生效（ui-rules 第 5 节），而且优先。
import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PageMeta, PageMode, PageView } from "../router/pages.ts";

export interface ShellPage {
  readonly page: PageMeta | undefined;
  readonly view: PageView | undefined;
  readonly mode: PageMode;
  /** 页面按数据选视图（传 null 回到默认视图）；视图的模式变了，外壳跟着换。 */
  readonly setView: (key: string | null) => void;
}

const NO_PAGE: ShellPage = { page: undefined, view: undefined, mode: "standard", setView: () => undefined };

export const ShellPageContext = createContext<ShellPage>(NO_PAGE);

export function useShellPage(): ShellPage {
  return useContext(ShellPageContext);
}

/** 沉浸页顶栏右侧留给页面放进度的位置。 */
export const ShellSlotContext = createContext<HTMLElement | null>(null);

/** 页面把进度（如“第 9 题，约 26 题”）放进沉浸页顶栏；不在沉浸模式时不显示。 */
export function ImmersiveProgress({ children }: { children: ReactNode }) {
  const node = useContext(ShellSlotContext);
  return node === null ? null : createPortal(children, node);
}
