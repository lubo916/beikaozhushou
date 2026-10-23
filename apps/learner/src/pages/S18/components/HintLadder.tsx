// 提示阶梯（S18-16）：提交前只给分级提示、不给答案；用过的几级按顺序都留着（U18b-Q3＝A），并说明用过提示最高记弱证据。
// 提示原文由接口一级一级给（S18QuizItem.hints），页面只显示。
import { useTranslation } from "react-i18next";
import type { S18QuizItem } from "@exam-prep/contract";

export function HintLadder({ item }: { item: S18QuizItem }) {
  const { t } = useTranslation("S18");
  const shown = item.hints.shown;
  if (shown.length === 0) return null;
  return (
    <section
      aria-label={t("question.hint_title")}
      aria-live="polite"
      className="flex flex-col gap-1 rounded-md bg-bg-sunk px-4 py-3 text-small"
    >
      <ol className="flex flex-col gap-1">
        {shown.map((text, index) => (
          <li key={text}>{t("question.hint_item", { n: index + 1, text })}</li>
        ))}
      </ol>
      <p className="text-ink-tertiary">{t("question.hint_note")}</p>
    </section>
  );
}
