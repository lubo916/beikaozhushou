import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx.ts";
import { UiLink } from "../lib/link.tsx";

export interface ListProps extends HTMLAttributes<HTMLUListElement> {
  /** 行与行之间画分隔线（默认画）。 */
  divided?: boolean | undefined;
}

export function List({ divided = true, className, ...rest }: ListProps) {
  return <ul {...rest} className={cx("ui-list", divided && "ui-list--divided", className)} />;
}

export interface ListRowProps {
  title: ReactNode;
  description?: ReactNode;
  /** 行首（图标、档位色块等）。 */
  leading?: ReactNode;
  /** 行尾的补充信息（时间、标签）。 */
  trailing?: ReactNode;
  /** 行尾的独立按钮（单独一个 Tab 停靠点）。 */
  action?: ReactNode;
  /** 整行可点：跳到 href，或调用 onSelect。 */
  href?: string | undefined;
  onSelect?: (() => void) | undefined;
  current?: boolean | undefined;
  className?: string | undefined;
}

/** 列表行（行列表）：放在 List 里用。 */
export function ListRow({ title, description, leading, trailing, action, href, onSelect, current = false, className }: ListRowProps) {
  const content = (
    <>
      {leading !== undefined && <span className="ui-row__lead">{leading}</span>}
      <span className="ui-row__text">
        <span className="ui-row__title">{title}</span>
        {description !== undefined && <span className="ui-row__desc">{description}</span>}
      </span>
      {trailing !== undefined && <span className="ui-row__trail">{trailing}</span>}
    </>
  );
  let main = <div className="ui-row__main">{content}</div>;
  if (href !== undefined) {
    main = (
      <UiLink href={href} className="ui-row__main ui-row__main--action" aria-current={current ? "page" : undefined}>
        {content}
      </UiLink>
    );
  } else if (onSelect !== undefined) {
    main = (
      <button type="button" className="ui-row__main ui-row__main--action" onClick={onSelect}>
        {content}
      </button>
    );
  }
  return (
    <li className={cx("ui-row", current && "ui-row--current", className)}>
      {main}
      {action !== undefined && <div className="ui-row__action">{action}</div>}
    </li>
  );
}
