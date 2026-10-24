import { useTranslation } from "react-i18next";
import type { P06ChangeEvent, P06ChangeImpact, P06ImpactScope } from "@exam-prep/contract";
import { formatCount, formatDate, formatPercent } from "@exam-prep/shared";
import { AiContent, Button, Card, DataTable, PageState, Tag, type TableColumn } from "@exam-prep/ui";

const SCOPE_KEYS = [
  "learner_count",
  "template_count",
  "knowledge_point_count",
  "question_count",
  "card_count",
  "mapped_page_count",
] as const;

interface EventTableProps {
  readonly data: P06ChangeImpact;
  /** 任务分派要后端与权限，先提示“即将上线”。 */
  readonly onAssign: () => void;
}

function ImpactCell({ event }: { event: P06ChangeEvent }) {
  const { t } = useTranslation("P06");
  const scope: P06ImpactScope = event.impact;
  // 只列接口给了、且不为零的计数；受影响学员数样本不足时接口不返回。
  const parts = SCOPE_KEYS.flatMap((key) => {
    const value = scope[key];
    return value === undefined || value === 0 ? [] : [t(`impact.${key}`, { n: formatCount(value) })];
  });
  return (
    <div className="flex flex-col gap-2">
      {/* feat:P06-03 影响范围分析：受影响的知识点、题、卡、模板与用户数（计数由接口给；AI 摘要带 AI 标识） */}
      <span>{parts.length === 0 ? t("impact.none") : parts.join(t("events.separator"))}</span>
      {event.impact_summary !== undefined && <AiContent note={t("events.aiNote")}>{event.impact_summary}</AiContent>}
    </div>
  );
}

export function EventTable({ data, onAssign }: EventTableProps) {
  const { t } = useTranslation("P06");
  const header = (key: string) => t(`events.columns.${key}`);
  const columns: readonly TableColumn<P06ChangeEvent>[] = [
    {
      key: "event",
      header: header("event"),
      label: header("event"),
      // feat:P06-02 变更事件登记：事件附官方文件与生效时间（登记入口见页头，先提示“即将上线”）。
      render: (row) => (
        <div className="flex flex-col gap-1">
          <strong>{row.title}</strong>
          <span>
            <Tag size="sm" tone="outline">
              {t(`kinds.${row.kind}`)}
            </Tag>
          </span>
          <span className="text-small text-ink-tertiary">{t("events.document", { name: row.official_document })}</span>
          <span className="text-small text-ink-tertiary">{t("events.effective", { date: formatDate(row.effective_on) })}</span>
        </div>
      ),
    },
    { key: "impact", header: header("impact"), label: header("impact"), render: (row) => <ImpactCell event={row} /> },
    {
      key: "progress",
      header: header("progress"),
      label: header("progress"),
      render: (row) => (
        <div className="flex flex-col items-start gap-2">
          <span>
            {row.progress === undefined
              ? t(`stage.${row.stage}`)
              : t("stageProgress", { stage: t(`stage.${row.stage}`), percent: formatPercent(row.progress) })}
          </span>
          {/* feat:P06-01 待更新标注：处理完成前受影响内容对用户标“待更新”，处理完成后撤下 */}
          {row.pending_update.marked ? (
            <span className="flex flex-col items-start gap-1">
              <Tag size="sm" tone="warning">
                {t("pending.marked")}
              </Tag>
              <span className="text-small text-ink-secondary">
                {t("pending.markedCount", { n: formatCount(row.pending_update.item_count) })}
              </span>
            </span>
          ) : (
            <Tag size="sm" tone="success">
              {t("pending.cleared")}
            </Tag>
          )}
          {/* feat:P06-04 任务分派：按考期远近与受影响人数排优先级（要后端，先提示“即将上线”） */}
          {row.stage !== "done" && (
            <Button size="sm" onClick={onAssign}>
              {t("actions.assign")}
            </Button>
          )}
        </div>
      ),
    },
  ];
  const analysis = data.analysis;
  return (
    <Card title={t("events.title")}>
      <div className="flex flex-col gap-3">
        <p className="text-small text-ink-secondary">{t("events.summary", { n: formatCount(data.total_count) })}</p>
        {!analysis.sample_sufficient && (
          <PageState
            compact
            state="insufficient_data"
            title={t("state.insufficient_data.title")}
            body={t("state.insufficient_data.body")}
            counts={[
              {
                key: "records",
                label: t("analysis.records"),
                value: t("analysis.count", { n: formatCount(analysis.learning_record_count) }),
              },
              {
                key: "minimum",
                label: t("analysis.minimum"),
                value: t("analysis.count", { n: formatCount(analysis.minimum_learning_record_count) }),
              },
            ]}
            missing={t("analysis.missing")}
          />
        )}
        <DataTable caption={t("events.caption")} columns={columns} rows={data.events} rowKey={(row) => row.event_id} stackOnNarrow />
      </div>
    </Card>
  );
}
