import { useTranslation } from "react-i18next";
import type { P05ExamAnalysis, P05MaturityTier } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared";
import { vocabLabel } from "@exam-prep/shared/vocab";
import { Card, DataTable, KeyValueList, Tag, type TableColumn } from "@exam-prep/ui";

// feat:P05-05 数据成熟度：四档决定学员端展示什么；当前档与原始计数都由接口给，页面只标出当前档。
export function MaturityCard({ data }: { data: P05ExamAnalysis }) {
  const { t } = useTranslation("P05");
  const header = (key: string) => t(`maturity.columns.${key}`);
  const columns: readonly TableColumn<P05MaturityTier>[] = [
    {
      key: "level",
      header: header("level"),
      label: header("level"),
      render: (row) => (
        <span className="flex flex-wrap items-center gap-1">
          <span>{vocabLabel("data_maturity", row.level)}</span>
          {row.level === data.maturity.level && (
            <Tag size="sm" tone="brand">
              {t("maturity.current")}
            </Tag>
          )}
        </span>
      ),
    },
    { key: "condition", header: header("condition"), label: header("condition"), render: (row) => t(`maturity.condition.${row.level}`) },
    { key: "display", header: header("display"), label: header("display"), render: (row) => t(`maturity.display.${row.learner_display}`) },
  ];
  return (
    <Card title={t("maturity.title")}>
      <div className="flex flex-col gap-3">
        <DataTable caption={t("maturity.caption")} columns={columns} rows={data.maturity_tiers} rowKey={(row) => row.level} stackOnNarrow />
        <KeyValueList
          items={[
            {
              key: "questions",
              label: t("maturity.questions"),
              value: t("maturity.count", { n: formatCount(data.maturity.question_count) }),
            },
            { key: "years", label: t("maturity.years"), value: t("maturity.yearCount", { n: formatCount(data.maturity.year_count) }) },
          ]}
        />
      </div>
    </Card>
  );
}
