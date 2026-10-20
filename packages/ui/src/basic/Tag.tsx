import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx.ts";

export type TagTone = "neutral" | "brand" | "success" | "warning" | "danger" | "ai" | "outline";

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: TagTone | undefined;
  size?: "sm" | "md" | undefined;
  icon?: ReactNode;
}

export function Tag({ tone = "neutral", size = "md", icon, className, children, ...rest }: TagProps) {
  return (
    <span {...rest} className={cx("ui-tag", `ui-tag--${tone}`, size === "sm" && "ui-tag--sm", className)}>
      {icon !== undefined && (
        <span className="ui-tag__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
