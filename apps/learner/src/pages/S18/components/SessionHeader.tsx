// 页头：题组名、练习模式、示例数据标记（空态也保留页头，F08-Q2）。
import { useTranslation } from "react-i18next";
import type { S18QuizSession } from "@exam-prep/contract";
import { vocabLabel } from "@exam-prep/shared/vocab";
import { Tag } from "@exam-prep/ui";

export function SessionHeader({ session }: { session: S18QuizSession }) {
  const { t } = useTranslation("S18");
  return (
    <header className="flex flex-wrap items-center gap-2">
      <h1 className="min-w-[0] flex-1 font-serif text-title font-bold text-ink-primary">{session.title}</h1>
      <Tag tone="brand" size="sm">
        {vocabLabel("practice_mode", session.mode)}
      </Tag>
      {session.data_source === "sample" && (
        <Tag tone="outline" size="sm">
          {t("sample")}
        </Tag>
      )}
    </header>
  );
}
