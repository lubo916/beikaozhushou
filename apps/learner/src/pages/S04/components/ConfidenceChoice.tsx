// 把握度四档（feat:S04-05）：确定、模糊、蒙的、不会，每题必选、没有默认，用来识别蒙对；“不会”只用于摸底（F01-Q1＝B）。
// 共用的把握度组件只有三档（U18a）：这里照它的样子多做一档“不会”（U04-Q1＝A）；整合任务给共用组件加上“不会”以后改回共用组件。
// 手机上四档两行两列放在拇指区，平板与桌面一行四个（“不会”窄一些）。
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { S04Confidence } from "@exam-prep/contract";
import { vocabLabel } from "@exam-prep/shared/vocab";
import { cx } from "@exam-prep/ui";
import { QUIZ_COPY } from "../../../../../../packages/ui/src/quiz/index.ts";

const CODES: readonly S04Confidence[] = ["sure", "vague", "guess", "unknown"];

export interface ConfidenceChoiceProps {
  readonly value: S04Confidence | null;
  readonly onChange: (value: S04Confidence) => void;
}

export function ConfidenceChoice({ value, onChange }: ConfidenceChoiceProps) {
  const { t } = useTranslation("S04");
  const name = useId();
  return (
    <fieldset className="flex flex-col">
      <legend className="mb-2 text-small font-bold text-ink-primary">
        {t("confidence.title")}
        <span className="ml-2 text-ink-tertiary">{t("confidence.required")}</span>
      </legend>
      <div className="grid grid-cols-2 gap-2 @tablet:grid-cols-[1fr_1fr_1fr_auto]">
        {CODES.map((code) => {
          const chosen = value === code;
          return (
            <label
              key={code}
              className={cx(
                "flex min-h-12 cursor-pointer flex-col justify-center rounded-md border px-3 py-2 focus-within:ring-2 focus-within:ring-brand-primary",
                code === "unknown" && "border-dashed",
                chosen ? "border-brand-primary bg-brand-primary-soft" : "border-line-strong bg-bg-surface",
              )}
            >
              <input type="radio" name={name} value={code} className="sr-only" checked={chosen} onChange={() => onChange(code)} />
              {code === "unknown" ? (
                <span className="text-ink-primary">{t("confidence.unknown")}</span>
              ) : (
                <>
                  <span className="font-bold text-ink-primary">{vocabLabel("confidence", code)}</span>
                  <span className="text-small text-ink-secondary">{QUIZ_COPY.confidence.hint[code]}</span>
                </>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
