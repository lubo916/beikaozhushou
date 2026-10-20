import { createContext, useContext, type ReactNode } from "react";

export interface LinkRenderProps {
  readonly href: string;
  readonly className?: string | undefined;
  readonly children: ReactNode;
  readonly "aria-current"?: "page" | undefined;
}

/** 链接怎么渲染：默认是普通 <a>；应用外壳用 UiLinkProvider 换成路由的 Link（跳转仍用路由表里的路径常量）。 */
export type LinkRenderer = (props: LinkRenderProps) => ReactNode;

const defaultRenderer: LinkRenderer = ({ href, className, children, ...rest }) => (
  <a href={href} className={className} {...rest}>
    {children}
  </a>
);

const LinkContext = createContext<LinkRenderer>(defaultRenderer);

export const UiLinkProvider = LinkContext.Provider;

export function UiLink(props: LinkRenderProps) {
  const render = useContext(LinkContext);
  return <>{render(props)}</>;
}
