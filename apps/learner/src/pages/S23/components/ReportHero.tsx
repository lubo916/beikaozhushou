import { useTranslation } from "react-i18next";
import type { S23AssessmentReport } from "@exam-prep/contract";
import { formatCount, formatDuration, formatPercent, formatScore } from "@exam-prep/shared/format";
import { AiContent, Card, PageState, Stat, StatGroup, Tag } from "@exam-prep/ui";

export function ReportHero({ report }: { report: S23AssessmentReport }) {
  const { t } = useTranslation("S23");
  const s = report.summary;
  // feat:S23-01 成绩与位置：差额和百分位均来自接口；样本不足时不展示百分位。
  return (
    <Card
      className="s23-hero"
      tone="brand"
      title={report.title}
      meta={report.pending_grading > 0 ? <Tag tone="warning">{t("hero.provisional")}</Tag> : undefined}
    >
      <StatGroup>
        <Stat
          label={t("hero.score")}
          value={formatScore(s.score, { total: s.total })}
          tone="brand"
          hint={
            <>
              <span>{t("hero.target", { score: formatScore(s.target) })}</span>
              <br />
              <span>{s.gap_kind === "on_target" ? t("hero.on_target") : t(`hero.${s.gap_kind}`, { score: formatScore(s.gap) })}</span>
            </>
          }
        />
        <Stat
          label={t("hero.duration")}
          value={formatDuration(s.duration_minutes)}
          hint={t("hero.screens") + " · " + formatCount(s.screen_switches, t("unit.times"))}
        />
        {s.rank_visible ? (
          <Stat
            label={t("hero.position")}
            value={t("hero.percentile", { percent: formatPercent(s.percentile) })}
            hint={t("hero.sample", { quantity: formatCount(s.sample_count, t("unit.person")) })}
          />
        ) : (
          <PageState
            compact
            state="insufficient_data"
            title={t("state.insufficient_data.title")}
            body={t("state.insufficient_data.body", { minimum: formatCount(s.minimum_sample_count) })}
            counts={[{ key: "samples", label: t("state.insufficient_data.count"), value: formatCount(s.sample_count, t("unit.person")) }]}
          />
        )}
      </StatGroup>
      {/* feat:S23-11 报告解读；feat:S23-12 低分表达，给可开始的最短路径。 */}
      <AiContent className="mt-4">
        <p className="font-medium">{t("hero.interpretation")}</p>
        <p>{s.interpretation}</p>
        <p className="mt-3 font-medium">{t("hero.path")}</p>
        <p>{s.low_score_path}</p>
      </AiContent>
    </Card>
  );
}
