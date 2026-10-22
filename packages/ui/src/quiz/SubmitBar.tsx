// 提交条（共用作答组件，S18-03 固定流程）：作答 → 选把握度 → 提交 → 揭晓。还不能提交时说清差哪一步；揭晓后换成“答案不能再改”与页面给的下一步按钮。
// 手机上贴在底部（拇指区）；平板、桌面跟在作答区后面。
import { useId, type ReactNode } from "react";
import { Button } from "../basic/Button.tsx";
import { cx } from "../lib/cx.ts";
import type { SubmitBlocker } from "./answer.ts";
import copy from "./copy.zh-CN.json";

export interface SubmitBarProps {
  /** 还差哪一步；null 表示可以提交。 */
  blocker: SubmitBlocker | null;
  onSubmit: () => void;
  busy?: boolean | undefined;
  submitLabel?: string | undefined;
  /** 已揭晓：不再显示提交，只说明答案不能再改。 */
  locked?: boolean | undefined;
  /** 作答时的辅助按钮（提示），或揭晓后的下一步（下一题、看小结）。 */
  children?: ReactNode;
  className?: string | undefined;
}

export function SubmitBar({
  blocker,
  onSubmit,
  busy = false,
  submitLabel = copy.submit.action,
  locked = false,
  children,
  className,
}: SubmitBarProps) {
  const hintId = useId();
  const reason = blocker === null ? null : copy.submit.blocker[blocker];
  return (
    <div
      className={cx(
        "sticky bottom-[0] z-10 flex flex-wrap items-center gap-3 border-t border-line-soft bg-bg-surface py-3 @tablet:static @tablet:border-t-0 @tablet:py-[0]",
        className,
      )}
    >
      {locked ? (
        <p className="text-small text-ink-secondary">{copy.submit.locked}</p>
      ) : (
        <Button
          variant="primary"
          busy={busy}
          disabled={blocker !== null}
          aria-describedby={reason === null ? undefined : hintId}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      )}
      {children}
      {!locked && reason !== null && (
        <p id={hintId} className="text-small text-ink-tertiary">
          {reason}
        </p>
      )}
    </div>
  );
}
