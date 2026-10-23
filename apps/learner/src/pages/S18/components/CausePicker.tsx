// 错因确认（S18-08）：错因七类、无默认、可以跳过，可以改选；选好的经接口记下，进练习小结与错题本。
// 导师建议的错因是 AI 初判（接口给）：只标出来供采纳，不替学员选（红线 3：AI 只能提议）。
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { S18ErrorCause } from "@exam-prep/contract";
import { vocabLabel } from "@exam-prep/shared/vocab";
import { AiBadge, Button, cx } from "@exam-prep/ui";
import { ERROR_CAUSES } from "../data.ts";

export interface CausePickerProps {
  /** 我选的错因（含刚点、还在记的）；没选为 null。 */
  readonly chosen: S18ErrorCause | null;
  /** 导师建议的错因（AI 初判）。 */
  readonly suggested: S18ErrorCause | undefined;
  readonly onChoose: (cause: S18ErrorCause) => void;
  readonly className?: string | undefined;
}

export function CausePicker({ chosen, suggested, onChoose, className }: CausePickerProps) {
  const { t } = useTranslation("S18");
  const titleId = useId();
  const [skipped, setSkipped] = useState(false);
  if (skipped && chosen === null) {
    return (
      <p className={cx("flex flex-wrap items-center gap-2 text-small text-ink-secondary", className)}>
        {t("reveal.cause_skipped")}
        <Button size="sm" variant="ghost" onClick={() => setSkipped(false)}>
          {t("reveal.cause_reopen")}
        </Button>
      </p>
    );
  }
  return (
    <section aria-labelledby={titleId} className={cx("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={titleId} className="font-bold">
          {t("reveal.cause_title")}
        </h3>
        {suggested !== undefined && (
          <span className="inline-flex items-center gap-1 text-small text-status-ai">
            <AiBadge size="xs" />
            {t("reveal.cause_suggest", { cause: vocabLabel("error_cause", suggested) })}
          </span>
        )}
      </div>
      <div role="group" aria-labelledby={titleId} className="flex flex-wrap gap-2">
        {ERROR_CAUSES.map((cause) => (
          <Button
            key={cause}
            size="sm"
            aria-pressed={chosen === cause}
            variant={chosen === cause ? "primary" : cause === suggested ? "ai" : "secondary"}
            onClick={() => onChoose(cause)}
          >
            {vocabLabel("error_cause", cause)}
          </Button>
        ))}
        {chosen === null && (
          <Button size="sm" variant="ghost" onClick={() => setSkipped(true)}>
            {t("reveal.cause_skip")}
          </Button>
        )}
      </div>
      <p className="text-small text-ink-tertiary" aria-live="polite">
        {chosen === null ? t("reveal.cause_note") : t("reveal.cause_saved", { cause: vocabLabel("error_cause", chosen) })}
      </p>
    </section>
  );
}
