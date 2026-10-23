import { useTranslation } from "react-i18next";
import type { P02MetricDictionary, P02MetricEntry } from "@exam-prep/contract";
import { formatDate, formatDateTime } from "@exam-prep/shared";
import { AiContent, Card, DataTable, Tag, type TableColumn, type TagTone } from "@exam-prep/ui";

const STATUS_TONE: Readonly<Record<P02MetricEntry["status"], TagTone>> = { active: "success", draft: "warning", deprecated: "neutral" };

// feat:P02-01 指标字典：每个指标的口径与版本（含版本记录）；口径冲突由 AI 标出并带 AI 标识。
export function DictionaryTable({ data }: { data: P02MetricDictionary }) {
  const { t } = useTranslation("P02");
  const header = (key: string) => t(`dictionary.columns.${key}`);
  const columns: readonly TableColumn<P02MetricEntry>[] = [
    {
      key: "name",
      header: header("name"),
      label: header("name"),
      render: (row) => (
        <div className="flex flex-col gap-1">
          <strong>{row.name}</strong>
          <span className="text-small text-ink-tertiary">{row.metric_id}</span>
          <span>
            <Tag size="sm" tone="outline">
              {t(`categories.${row.category}`)}
            </Tag>
          </span>
        </div>
      ),
    },
    {
      key: "definition",
      header: header("definition"),
      label: header("definition"),
      render: (row) => (
        <div className="flex flex-col gap-2">
          <span>{row.definition}</span>
          {row.ai_conflict_note !== undefined && <AiContent note={t("dictionary.aiNote")}>{row.ai_conflict_note}</AiContent>}
        </div>
      ),
    },
    {
      key: "version",
      header: header("version"),
      label: header("version"),
      render: (row) => (
        <details>
          <summary>{row.version}</summary>
          <ol className="flex flex-col gap-1 text-small">
            {row.versions.map((entry) => (
              <li key={entry.version}>
                {t("dictionary.versions", { version: entry.version, date: formatDate(entry.effective_from), note: entry.change_note })}
              </li>
            ))}
            <li className="text-ink-tertiary">{t("dictionary.updated", { time: formatDateTime(row.updated_at, data.time_zone) })}</li>
          </ol>
        </details>
      ),
    },
    {
      key: "status",
      header: header("status"),
      label: header("status"),
      render: (row) => (
        <Tag size="sm" tone={STATUS_TONE[row.status]}>
          {t(`status.${row.status}`)}
        </Tag>
      ),
    },
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
