import { useTranslation } from "react-i18next";
import type { P02MetricDictionary, P02MetricEntry } from "@exam-prep/contract";
import { formatDate, formatDateTime } from "@exam-prep/shared";
import { AiContent, Card, DataTable, Tag, type TableColumn, type TagTone } from "@exam-prep/ui";

const STATUS_TONE: Readonly<Record<P02MetricEntry["status"], TagTone>> = { active: "success", draft: "warning", deprecated: "neutral" };

// feat:P02-01 指标字典：每个指标的口径与版本（含版本记录）；口径冲突由 AI 标出并带 AI 标识。
export function DictionaryTable({ data }: { data: P02MetricDictionary }) {
  const { t } = useTranslation("P02");
  const columns: readonly TableColumn<P02MetricEntry>[] = [
    {
      key: "name",
      header: t("dictionary.columns.name"),
      render: (row) => (
        <div className="flex flex-col gap-1">
          <strong>{row.name}</strong>
          <span className="text-small text-ink-tertiary">{row.metric_id}</span>
        </div>
      ),
    },
    { key: "category", header: t("dictionary.columns.category"), render: (row) => t(`categories.${row.category}`) },
    {
      key: "definition",
      header: t("dictionary.columns.definition"),
      render: (row) => (
        <div className="flex flex-col gap-2">
          <span>{row.definition}</span>
          {row.ai_conflict_note !== undefined && <AiContent note={t("dictionary.aiNote")}>{row.ai_conflict_note}</AiContent>}
        </div>
      ),
    },
    {
      key: "version",
      header: t("dictionary.columns.version"),
      render: (row) => (
        <details>
          <summary>{row.version}</summary>
          <ol className="flex flex-col gap-1 text-small">
            {row.versions.map((entry) => (
              <li key={entry.version}>
                {t("dictionary.versions", { version: entry.version, date: formatDate(entry.effective_from), note: entry.change_note })}
              </li>
            ))}
          </ol>
        </details>
      ),
    },
    {
      key: "status",
      header: t("dictionary.columns.status"),
      render: (row) => (
        <Tag size="sm" tone={STATUS_TONE[row.status]}>
          {t(`status.${row.status}`)}
        </Tag>
      ),
    },
    { key: "updated", header: t("dictionary.columns.updated"), render: (row) => formatDateTime(row.updated_at, data.time_zone) },
  ];
  return (
    <Card title={t("dictionary.title")}>
      <div className="flex flex-col gap-3">
        <p className="text-small text-ink-secondary">
          {t(data.glossary_aligned ? "dictionary.aligned" : "dictionary.misaligned", { n: data.total_count })}
        </p>
        <DataTable caption={t("dictionary.caption")} columns={columns} rows={data.items} rowKey={(row) => row.metric_id} stackOnNarrow />
      </div>
    </Card>
  );
}
