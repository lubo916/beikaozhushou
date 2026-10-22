// 把握度（共用作答组件，S18-04）：确定、模糊、蒙的三档，必选、没有默认；学员关了把握度就不显示选项，只说明“做对最高记中证据”。
// 日常做题不提供“不会”（F01-Q1，勘误第 5 条）；揭晓后锁定。手机上两列放在拇指区，平板与桌面一行三个。
import { useId } from "react";
import { vocabLabel } from "@exam-prep/shared/vocab";
import { cx } from "../lib/cx.ts";
import { QUIZ_CONFIDENCES, type QuizConfidence } from "./answer.ts";
import copy from "./copy.zh-CN.json";

export interface ConfidencePickerProps {
  value: QuizConfidence | null;
  onChange: (value: QuizConfidence) => void;
  locked?: boolean | undefined;
  /** 学员关了把握度：不用选。 */
  off?: boolean | undefined;
  className?: string | undefined;
}

export function ConfidencePicker({ value, onChange, locked = false, off = false, className }: ConfidencePickerProps) {
  const name = useId();
  if (off) return <p className={cx("text-small text-ink-secondary", className)}>{copy.confidence.off}</p>;
  return (
    <fieldset className={cx("flex flex-col", className)}>
      <legend className="mb-2 text-small font-bold text-ink-primary">
        {copy.confidence.title}
        <span className="ml-2 text-ink-tertiary">{copy.confidence.required}</span>
      </legend>
      <div className="grid grid-cols-2 gap-2 @tablet:grid-cols-3">
        {QUIZ_CONFIDENCES.map((code) => {
          const chosen = value === code;
          return (
            <label
              key={code}
              className={cx(
                "flex min-h-12 flex-col justify-center rounded-md border px-3 py-2 focus-within:ring-2 focus-within:ring-brand-primary",
                locked ? "cursor-default" : "cursor-pointer",
                chosen ? "border-brand-primary bg-brand-primary-soft" : "border-line-strong bg-bg-surface",
              )}
            >
              <input
                type="radio"
                name={name}
                value={code}
                className="sr-only"
                checked={chosen}
                disabled={locked}
                onChange={() => onChange(code)}
              />
              <span className="font-bold text-ink-primary">{vocabLabel("confidence", code)}</span>
              <span className="text-small text-ink-secondary">{copy.confidence.hint[code]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
