// 三种方式卡（feat:S04-09 开始页）：自适应诊断（feat:S04-01 自适应选题）、快速定位（feat:S04-03）、章节抽测（feat:S04-02 按知识点抽题），
// 各写约几题、几分钟与代价。能不能用、默认选中、推荐都由接口按题源定（规则卡 R2、R3）；不能用的置灰并写原因。单选：方向键在卡片间移动。
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { S04Mode, S04ModeOption } from "@exam-prep/contract";
import { cx } from "@exam-prep/ui";

export interface ModeCardsProps {
  readonly modes: readonly S04ModeOption[];
  readonly value: S04Mode | undefined;
  readonly onChange: (mode: S04Mode) => void;
}

export function ModeCards({ modes, value, onChange }: ModeCardsProps) {
  const { t } = useTranslation("S04");
  const name = useId();
  const lengthOf = (option: S04ModeOption): string => {
    if (!option.available && option.unavailable_reason !== undefined) return t(`mode.unavailable.${option.unavailable_reason}.length`);
    if (option.mode === "quick") return t("mode.quick.length", { minutes: option.minutes });
    if (option.mode === "chapter") {
      const range = option.chapter_items;
      return range === undefined
        ? t("mode.chapter.length_plain", { minutes: option.minutes })
        : t("mode.chapter.length", { min: range.min, max: range.max, minutes: option.minutes });
    }
    return option.items === undefined
      ? t("mode.length_minutes", { minutes: option.minutes })
      : t(`mode.${option.mode}.length`, { items: option.items, minutes: option.minutes });
  };
  const costOf = (option: S04ModeOption): string => {
    if (!option.available && option.unavailable_reason !== undefined) return t(`mode.unavailable.${option.unavailable_reason}.cost`);
    if (option.recommended && option.source !== undefined) return t("mode.recommended", { source: t(`mode.source.${option.source}`) });
    return t(`mode.${option.mode}.cost`);
  };
  return (
    <fieldset className="flex flex-col">
      <legend className="sr-only">{t("mode.label")}</legend>
      <div className="grid gap-3 @tablet:grid-cols-3">
        {modes.map((option) => {
          const chosen = option.available && option.mode === value;
          const muted = option.available ? "text-ink-secondary" : "text-ink-tertiary";
          return (
            <label
              key={option.mode}
              className={cx(
                "flex flex-col gap-1 rounded-md border px-4 py-3 focus-within:ring-2 focus-within:ring-brand-primary",
                option.available ? "cursor-pointer" : "cursor-not-allowed",
                chosen
                  ? "border-brand-primary bg-brand-primary-soft"
                  : option.available
                    ? "border-line-strong bg-bg-surface"
                    : "border-line-soft bg-bg-sunk",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.mode}
                className="sr-only"
                checked={chosen}
                disabled={!option.available}
                onChange={() => onChange(option.mode)}
              />
              <span className={cx("font-bold", option.available ? "text-ink-primary" : "text-ink-tertiary")}>
                {t(`mode.${option.mode}.title`)}
              </span>
              <span className={cx("text-small", muted)}>{lengthOf(option)}</span>
              <span className={cx("text-small", muted)}>{costOf(option)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
