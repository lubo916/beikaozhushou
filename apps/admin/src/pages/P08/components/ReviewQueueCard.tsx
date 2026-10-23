import { useTranslation } from "react-i18next";
import type { P08DualReview, P08QuestionReview, P08ReviewTask, P08ReviewVerdict } from "@exam-prep/contract";
import { credibilityLabel } from "@exam-prep/shared";
import { Button, Card, DataTable, FilterChips, Tag, type FilterChipOption, type TableColumn, type TagTone } from "@exam-prep/ui";
import { ORIGINS, type OriginFilter } from "../data.ts";

const VERDICT_TONE: Readonly<Record<P08ReviewVerdict, TagTone>> = { pending: "outline", passed: "success", rejected: "danger" };

/** 一审、二审各一个标签：两位审核人分别核对（结论由接口给）。 */
function DualReview({ review }: { review: P08DualReview }) {
  const { t } = useTranslation("P08");
  return (
    <span className="flex flex-wrap gap-1">
      <Tag size="sm" tone={VERDICT_TONE[review.first]}>
        {t("queue.first", { verdict: t(`queue.verdicts.${review.first}`) })}
      </Tag>
      <Tag size="sm" tone={VERDICT_TONE[review.second]}>
        {t("queue.second", { verdict: t(`queue.verdicts.${review.second}`) })}
      </Tag>
    </span>
  );
}

interface ReviewQueueCardProps {
  readonly data: P08QuestionReview;
  readonly origin: OriginFilter;
  readonly onOrigin: (origin: OriginFilter) => void;
  readonly onSoon: () => void;
}

// feat:P08-01 审核队列：新入库与被修改的题双人审核，答案与解析分别核对；“去核对”还没有后端，点了提示即将上线（F08-Q4）。
export function ReviewQueueCard({ data, origin, onOrigin, onSoon }: ReviewQueueCardProps) {
  const { t } = useTranslation("P08");
  const options: FilterChipOption<OriginFilter>[] = [
    { value: "all", label: t("queue.origins.all") },
    ...ORIGINS.map((value) => ({ value, label: t(`queue.origins.${value}`), count: data.origin_counts[value] })),
  ];
  const columns: TableColumn<P08ReviewTask>[] = [
    {
      key: "question",
      header: t("queue.columns.question"),
      label: t("queue.columns.question"),
      render: (task) => (
        <span className="flex flex-col gap-1">
          <strong>{task.question_ref}</strong>
          <span className="text-small text-ink-secondary">{task.stem}</span>
        </span>
      ),
    },
    {
      key: "origin",
      header: t("queue.columns.origin"),
      label: t("queue.columns.origin"),
      render: (task) => (
        <span className="flex flex-wrap gap-1">
          <Tag size="sm" tone="outline">
            {t(`queue.origins.${task.origin}`)}
          </Tag>
          <Tag size="sm">{credibilityLabel(task.credibility)}</Tag>
        </span>
      ),
    },
    {
      key: "answer",
      header: t("queue.columns.answer"),
      label: t("queue.columns.answer"),
      render: (task) => <DualReview review={task.answer_review} />,
    },
    {
      key: "solution",
      header: t("queue.columns.solution"),
      label: t("queue.columns.solution"),
      render: (task) => <DualReview review={task.solution_review} />,
    },
    {
      key: "action",
      header: t("queue.columns.action"),
      label: t("queue.columns.action"),
      render: () => (
        <Button size="sm" onClick={onSoon}>
          {t("queue.check")}
        </Button>
      ),
    },
  ];
  return (
    <Card title={t("queue.title")} meta={t("queue.meta")}>
      <div className="flex flex-col gap-3">
        <FilterChips
          label={t("queue.filter")}
          options={options}
          selected={[origin]}
          multiple={false}
          onChange={(next) => onOrigin(next[0] ?? "all")}
        />
        <DataTable
          caption={t("queue.title")}
          columns={columns}
          rows={data.tasks}
          rowKey={(task) => task.id}
          stackOnNarrow
          empty={t("queue.none")}
        />
      </div>
    </Card>
  );
}
