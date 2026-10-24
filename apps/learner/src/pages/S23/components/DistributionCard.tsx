import { useTranslation } from "react-i18next";
import type { S23Distribution } from "@exam-prep/contract";
import { formatCount, formatPercent, formatScore } from "@exam-prep/shared/format";
import { Button, Card, ProgressBar } from "@exam-prep/ui";
export interface ReviewFilter {
  readonly name: string;
  readonly ids?: readonly string[];
}
export function DistributionCard({
  title,
  groups,
  onSelect,
  hint,
}: {
  title: string;
  groups: readonly S23Distribution[];
  onSelect: (filter: ReviewFilter) => void;
  hint?: string;
}) {
  const { t } = useTranslation("S23");
  return (
    <Card title={title}>
      {hint && <p className="mb-3 text-small text-ink-secondary">{hint}</p>}
      <ul className="flex flex-col gap-3">
        {groups.map((item) => (
          <li key={item.id}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("loss.legend", { name: item.name })}
                onClick={() => onSelect({ name: item.name, ids: item.question_ids })}
              >
                {item.name}
              </Button>
              <span className="text-small tabular-nums">
                {t("loss.lost", { score: formatScore(item.lost_score), quantity: formatCount(item.count, t("unit.question")) })}
              </span>
            </div>
            <ProgressBar value={item.ratio} label={item.name} valueText={formatPercent(item.ratio)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
