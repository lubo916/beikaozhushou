import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { S33Field, S33Option } from "@exam-prep/contract";
import { formatDuration, formatNumber, formatPercent } from "@exam-prep/shared/format";

function optionValue(option: S33Option): string | undefined {
  if (option.numeric_value === undefined) return undefined;
  if (option.unit === "minutes") return formatDuration(option.numeric_value);
  if (option.unit === "percent") return formatPercent(option.numeric_value);
  return formatNumber(option.numeric_value, 0);
}
export function PreferenceField({ field, value, onChange }: { field: S33Field; value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation("S33");
  const id = useId();
  const helpId = `${id}-help`;
  const controlClass =
    "w-full min-w-0 rounded-sm border border-line-strong bg-surface p-2 text-ink-primary focus-visible:outline-2 focus-visible:outline-brand-primary";
  return (
    <div className="grid min-w-0 gap-2 border-b border-line-soft py-3 @tablet:grid-cols-2">
      <div>
        <label htmlFor={id} className="font-medium">
          {t(`field.${field.id}.label`)}
        </label>
        <p id={helpId} className="text-small text-ink-secondary">
          {t(`field.${field.id}.help`)}
        </p>
      </div>
      {field.kind === "toggle" ? (
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={value === "enabled"}
          aria-describedby={helpId}
          className={controlClass}
          onClick={() => onChange(value === "enabled" ? "disabled" : "enabled")}
        >
          {t(`option.${value}`)}
        </button>
      ) : field.kind === "time" || field.kind === "text" ? (
        <input
          id={id}
          type={field.kind === "time" ? "time" : "text"}
          value={value}
          aria-describedby={helpId}
          className={controlClass}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <select id={id} value={value} aria-describedby={helpId} className={controlClass} onChange={(event) => onChange(event.target.value)}>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {t(`option.${option.label_key}`, { value: optionValue(option) })}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
