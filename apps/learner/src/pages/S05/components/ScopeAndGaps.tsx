import { useTranslation } from "react-i18next";
import type { S05StartReport } from "@exam-prep/contract";
import { formatCount, formatDuration, formatScore } from "@exam-prep/shared/format";
import { Card, DataTable, ProposalCard, Tag } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

interface SectionProps {
  readonly data: S05StartReport;
  /** 地图体检不通过：预测类数字（可提分、分数代价）不显示，性价比阶梯置灰（决定 U05-Q1＝A）。 */
  readonly locked?: boolean;
}

export function GapTable({ data, locked = false }: SectionProps) {
  const { t } = useTranslation("S05");
  // feat:S05-03 归因、提分、时间和性价比只读接口，建议文案来自本页中文词条；体检不通过时只给来源与建议。
  return (
    <Card title={t("gap.title")} meta={locked ? t("gap.locked_hint") : undefined} flush>
      <DataTable
        caption={t("gap.title")}
        stackOnNarrow
        rows={data.gaps}
        rowKey={(row) => row.kind}
        columns={[
          { key: "kind", header: t("gap.kind"), label: t("gap.kind"), render: (row) => t(`gap.${row.kind}`) },
          {
            key: "gain",
            header: t("gap.gain"),
            label: t("gap.gain"),
            render: (row) => (locked ? t("locked.hidden") : formatScore(row.points_gain)),
          },
          { key: "minutes", header: t("gap.minutes"), label: t("gap.minutes"), render: (row) => formatDuration(row.minutes) },
          {
            key: "roi",
            header: t("gap.roi"),
            label: t("gap.roi"),
            render: (row) => <Tag tone={locked || row.roi === "D" ? "neutral" : "brand"}>{row.roi}</Tag>,
          },
          { key: "advice", header: t("gap.advice"), label: t("gap.advice"), render: (row) => t(`gap.suggestion.${row.kind}`) },
        ]}
      />
    </Card>
  );
}
export function ScopeDraft({ data, locked = false }: SectionProps) {
  const { t } = useTranslation("S05");
  const toast = useToast();
  const scope = data.scope;
  // feat:S05-06 只展示初稿和四行提议，不自动改变范围；写权限登记后由整合任务接通。
  return (
    <Card id="s05-scope" title={t("scope.title")}>
      <p>{t("scope.intro", { amount: formatCount(scope.total_count) })}</p>
      <div className="my-4">
        <DataTable
          caption={t("scope.title")}
          stackOnNarrow
          rows={scope.removals}
          rowKey={(row) => row.id}
          columns={[
            { key: "name", header: t("scope.name"), label: t("scope.name"), render: (row) => row.name },
            { key: "roi", header: t("gap.roi"), label: t("gap.roi"), render: (row) => <Tag>{row.roi}</Tag> },
            { key: "minutes", header: t("scope.minutes"), label: t("scope.minutes"), render: (row) => formatDuration(row.minutes) },
            {
              key: "cost",
              header: t("scope.cost"),
              label: t("scope.cost"),
              render: (row) => (locked ? t("locked.hidden") : formatScore(row.score_cost)),
            },
          ]}
        />
      </div>
      <ProposalCard
        title={t("scope.proposal")}
        aiGenerated
        status="pending"
        what={t("scope.what", { amount: formatCount(scope.removed_count), duration: formatDuration(scope.saved_minutes) })}
        why={t("scope.why")}
        cost={locked ? t("scope.cost_locked") : t("scope.cost_text", { score: formatScore(scope.score_cost) })}
        ifNot={t("scope.if_not")}
        onConfirm={() => toast(t("soon.proposal"))}
        onDecline={() => toast(t("soon.decline"))}
      />
      <p className="mt-3 text-small text-ink-tertiary">{t("scope.pending")}</p>
    </Card>
  );
}
