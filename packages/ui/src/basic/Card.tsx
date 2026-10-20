import { useId, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../lib/cx.ts";

export type CardTone = "default" | "sunk" | "brand" | "warning" | "danger" | "success" | "ai";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  /** 标题旁的补充（如三个数卡片上的问句“够不够”）。 */
  meta?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  tone?: CardTone | undefined;
  /** 标题层级，页内卡片默认 h2。 */
  headingLevel?: 2 | 3 | 4 | undefined;
  as?: "section" | "article" | "div" | undefined;
  /** 内容贴边（里面放列表或表格时用）。 */
  flush?: boolean | undefined;
}

/** 面板（原型里调用最多的部件）：标题、动作、内容、页脚。 */
export function Card({
  title,
  meta,
  actions,
  footer,
  tone = "default",
  headingLevel = 2,
  as: Tag = "section",
  flush = false,
  className,
  children,
  ...rest
}: CardProps) {
  const headingId = useId();
  const Heading = `h${headingLevel}` as const;
  return (
    <Tag
      {...rest}
      className={cx("ui-card", tone !== "default" && `ui-card--${tone}`, flush && "ui-card--flush", className)}
      aria-labelledby={title !== undefined ? headingId : undefined}
    >
      {(title !== undefined || actions !== undefined) && (
        <header className="ui-card__head">
          {title !== undefined && (
            <div className="ui-card__titles">
              <Heading id={headingId} className="ui-card__title">
                {title}
              </Heading>
              {meta !== undefined && <span className="ui-card__meta">{meta}</span>}
            </div>
          )}
          {actions !== undefined && <div className="ui-card__actions">{actions}</div>}
        </header>
      )}
      <div className="ui-card__body">{children}</div>
      {footer !== undefined && <footer className="ui-card__foot">{footer}</footer>}
    </Tag>
  );
}
