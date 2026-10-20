import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx.ts";
import { Icon, type IconName } from "./Icon.tsx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "ai";
export type ButtonSize = "sm" | "md";

/** 按钮的类名：给路由 Link 之类的元素套用按钮外观。 */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", block = false): string {
  return cx("ui-btn", `ui-btn--${variant}`, size === "sm" && "ui-btn--sm", block && "ui-btn--block");
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  /** 默认 button，避免在表单里误提交。 */
  type?: "button" | "submit" | "reset" | undefined;
  /** 进行中：按钮不可再点，读屏念“忙”。 */
  busy?: boolean | undefined;
  icon?: ReactNode;
  block?: boolean | undefined;
}

export function Button({
  variant = "secondary",
  size = "md",
  type = "button",
  busy = false,
  icon,
  block = false,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cx(buttonClass(variant, size, block), className)}
      disabled={disabled === true || busy}
      aria-busy={busy || undefined}
    >
      {icon !== undefined && (
        <span className="ui-btn__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> {
  /** 读屏与悬停提示用的名称（图标按钮必须有）。 */
  label: string;
  icon: IconName;
}

export function IconButton({ label, icon, className, ...rest }: IconButtonProps) {
  return (
    <button {...rest} type="button" className={cx("ui-iconbtn", className)} aria-label={label} title={label}>
      <Icon name={icon} />
    </button>
  );
}
