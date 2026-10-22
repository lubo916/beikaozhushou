import { useTranslation } from "react-i18next";
import type { S07PlanOverview } from "@exam-prep/contract";
import { formatDate, formatPercent } from "@exam-prep/shared/format";
import { Button, Card, ProgressBar, Tag } from "@exam-prep/ui";

// feat:S07-01 feat:S07-02 feat:S07-03 常驻路线，不把轮次另拆成第二条阶段轴。
export function Timeline({ data, onRounds }: { data: S07PlanOverview; onRounds: () => void }) {
  const { t } = useTranslation("S07");
  const active = data.rounds.find((round) => round.status === "active");
  return (
    <Card
      data-testid="round-timeline"
      title={t("timeline.title")}
      actions={
        <Button size="sm" onClick={onRounds}>
          {t("timeline.edit")}
        </Button>
      }
    >
      <ol className="s07-timeline">
        {data.rounds.map((round) => (
          <li key={round.id} className={`s07-round s07-round--${round.status}`}>
            <strong>{round.name}</strong>
            <span>
              {formatDate(round.start)} — {formatDate(round.end)}
            </span>
            <span>
              {t("timeline.depth")} · {round.depth}
            </span>
            <span>{round.mix}</span>
            <Tag tone={round.status === "active" ? "brand" : round.status === "pending" ? "warning" : "neutral"}>
              {t(`timeline.${round.status}`)}
            </Tag>
          </li>
        ))}
      </ol>
      {active !== undefined && (
        <div className="mt-3">
          <ProgressBar label={t("timeline.coverage")} value={active.coverage} valueText={formatPercent(active.coverage)} showLabel />
        </div>
      )}
      <p className="mt-2 text-small text-ink-secondary">{t("timeline.keep")}</p>
    </Card>
  );
}
