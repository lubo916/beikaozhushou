import type { ClipboardEvent, ReactNode } from "react";
import { markAiGenerated } from "@exam-prep/shared/format";
import { Icon } from "../basic/Icon.tsx";
import { COPY } from "../lib/copy.ts";
import { cx } from "../lib/cx.ts";

export interface AiBadgeProps {
  label?: string | undefined;
  size?: "xs" | "sm" | undefined;
  className?: string | undefined;
}

/** AI 内容标识（显式标识，红线 4）。 */
export function AiBadge({ label = COPY.ai.label, size = "sm", className }: AiBadgeProps) {
  return (
    <span className={cx("ui-ai-badge", size === "xs" && "ui-ai-badge--xs", className)}>
      <Icon name="sparkle" />
      {label}
    </span>
  );
}

export interface AiContentProps {
  children: ReactNode;
  label?: string | undefined;
  /** 标识旁的补充（如“导师生成，未经你确认”）。 */
  note?: ReactNode;
  className?: string | undefined;
}

/** AI 生成的内容一律用它包起来：带显式标识；从这里复制出去的文字开头带“【AI 生成】”。 */
export function AiContent({ children, label = COPY.ai.label, note, className }: AiContentProps) {
  const onCopy = (event: ClipboardEvent<HTMLDivElement>) => {
    const text = document.getSelection()?.toString() ?? "";
    if (!text) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", markAiGenerated(text, label));
  };
  return (
    <div className={cx("ui-ai", className)} onCopy={onCopy}>
      <div className="ui-ai__head">
        <AiBadge label={label} />
        {note !== undefined && <span className="ui-ai__note">{note}</span>}
      </div>
      <div className="ui-ai__body">{children}</div>
    </div>
  );
}

export interface ReasonTagsProps {
  /** 每条理由：模板句加接口字段里的数字（页面填好后传入）。 */
  reasons: readonly ReactNode[];
  /** 措辞经过 AI 润色时带 AI 标识；导师不可用时显示模板句、不带标识。 */
  aiPolished?: boolean | undefined;
  className?: string | undefined;
}

/** “为什么是它”理由标签。 */
export function ReasonTags({ reasons, aiPolished = false, className }: ReasonTagsProps) {
  if (reasons.length === 0) return null;
  return (
    <p className={cx("ui-reasons", className)}>
      <span className="ui-visually-hidden">{COPY.reason.lead}：</span>
      {reasons.map((reason, index) => (
        <span key={index} className="ui-reason">
          {reason}
        </span>
      ))}
      {aiPolished && <AiBadge size="xs" />}
    </p>
  );
}
