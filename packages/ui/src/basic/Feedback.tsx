import type { ReactNode } from "react";
import { formatPercent } from "@exam-prep/shared/format";
import { COPY } from "../lib/copy.ts";
import { cx } from "../lib/cx.ts";
import { IconButton } from "./Button.tsx";
import { Icon, type IconName } from "./Icon.tsx";

export type BannerTone = "info" | "success" | "warning" | "danger" | "ai";

const BANNER_ICON: Record<BannerTone, IconName> = { info: "info", success: "check", warning: "alert", danger: "alert", ai: "sparkle" };

export interface BannerProps {
  tone?: BannerTone | undefined;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: (() => void) | undefined;
  dismissLabel?: string | undefined;
  className?: string | undefined;
}

/** 提示条：出错类用 alert（立即念出），其余用 status（不打断）。 */
export function Banner({ tone = "info", title, children, action, onDismiss, dismissLabel = COPY.action.dismiss, className }: BannerProps) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("ui-banner", `ui-banner--${tone}`, className)}>
      <span className="ui-banner__icon">
        <Icon name={BANNER_ICON[tone]} />
      </span>
      <div className="ui-banner__text">
        {title !== undefined && <strong className="ui-banner__title">{title}</strong>}
        {children !== undefined && <div className="ui-banner__body">{children}</div>}
      </div>
      {(action !== undefined || onDismiss !== undefined) && (
        <div className="ui-banner__actions">
          {action}
          {onDismiss !== undefined && <IconButton label={dismissLabel} icon="close" onClick={onDismiss} />}
        </div>
      )}
    </div>
  );
}

export type ProgressTone = "brand" | "success" | "warning" | "danger" | "ai" | "mastery";

export interface ProgressBarProps {
  /** 0–1 的比例（接口返回的完成度等，页面不重算）。 */
  value: number;
  /** 名称：读屏用，showLabel 时也显示出来。 */
  label: string;
  showLabel?: boolean | undefined;
  /** 显示的取值文字，默认按百分比。 */
  valueText?: string | undefined;
  tone?: ProgressTone | undefined;
  size?: "sm" | "md" | undefined;
  className?: string | undefined;
}

export function ProgressBar({ value, label, showLabel = true, valueText, tone = "brand", size = "md", className }: ProgressBarProps) {
  const ratio = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const text = valueText ?? formatPercent(ratio);
  const percent = Math.round(ratio * 100);
  return (
    <div className={cx("ui-progress", `ui-progress--${tone}`, size === "sm" && "ui-progress--sm", className)}>
      {showLabel && (
        <div className="ui-progress__head" aria-hidden="true">
          <span>{label}</span>
          <span className="ui-progress__value">{text}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={text}
        className="ui-progress__track"
      >
        <span className="ui-progress__bar" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export interface SkeletonProps {
  /** 几行文字占位。 */
  lines?: number | undefined;
  /** 先放一个标题占位。 */
  title?: boolean | undefined;
  /** 再放一块大的占位（图表、卡片）。 */
  block?: boolean | undefined;
  className?: string | undefined;
}

/** 占位骨架：加载时代替内容的形状，读屏跳过（加载状态由 PageState 念出）。 */
export function Skeleton({ lines = 3, title = false, block = false, className }: SkeletonProps) {
  return (
    <div className={cx("ui-skel", className)} aria-hidden="true">
      {title && <span className="ui-skel__line ui-skel__line--title" />}
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="ui-skel__line" />
      ))}
      {block && <span className="ui-skel__block" />}
    </div>
  );
}
