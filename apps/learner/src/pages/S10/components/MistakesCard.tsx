// 我在这里怎么错：错误模式的一句话归纳（AI 生成的带标识）、做错过的选项表，以及“对比易混点”“生成辨析卡”。
import { useTranslation } from "react-i18next";
import type { S10MistakeRow, S10Mistakes } from "@exam-prep/contract";
import { EMPTY_VALUE } from "@exam-prep/shared/format";
import { VOCAB } from "@exam-prep/shared/vocab";
import { AiContent, Button, Card, DataTable, type TableColumn } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export function MistakesCard({ mistakes }: { mistakes: S10Mistakes }) {
  const { t } = useTranslation("S10");
  const toast = useToast();
  const columns: readonly TableColumn<S10MistakeRow>[] = [
    {
      key: "chosen",
      header: t("mistakes.col_chosen"),
      label: t("mistakes.col_chosen"),
      render: (row) => <span className="font-bold tabular-nums">{row.chosen}</span>,
    },
    {
      key: "reason",
      header: t("mistakes.col_reason"),
      label: t("mistakes.col_reason"),
      render: (row) => (
        <>
          {row.reason}
          {row.trap === undefined && row.error_cause !== undefined && (
            <span className="text-ink-tertiary">{t("mistakes.cause_note", { cause: VOCAB.error_cause[row.error_cause] })}</span>
          )}
        </>
      ),
    },
    {
      key: "trap",
      header: t("mistakes.col_trap"),
      label: t("mistakes.col_trap"),
      render: (row) => (row.trap === undefined ? EMPTY_VALUE : VOCAB.trap_type[row.trap]),
    },
  ];
  const pattern = mistakes.pattern;
  const patternText = pattern === undefined ? undefined : t("mistakes.pattern", { text: pattern.text });
  return (
    <Card
      title={t("mistakes.title")}
      footer={
        <div className="flex flex-wrap gap-2">
          {/* feat:S10-14 易混对比（P1）：与易混点的差异对照，差异点来自自己的错题 */}
          <Button size="sm" onClick={() => toast(t("soon.compare"))}>
            {t("mistakes.compare")}
          </Button>
          <Button size="sm" onClick={() => toast(t("soon.make_card"))}>
            {t("mistakes.make_card")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* feat:S10-15 错误模式归纳（P1）：把反复犯的错总结成一句话；AI 生成的带显式标识（红线 4） */}
        {pattern !== undefined &&
          (pattern.ai_generated ? (
            <AiContent note={t("mistakes.pattern_note")}>
              <p>{patternText}</p>
            </AiContent>
          ) : (
            <p>{patternText}</p>
          ))}
        <DataTable
          caption={t("mistakes.caption")}
          columns={columns}
          rows={mistakes.rows}
          rowKey={(row) => `${row.question_id}:${row.chosen}`}
          empty={t("mistakes.none")}
          stackOnNarrow
        />
      </div>
    </Card>
  );
}
