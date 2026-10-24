import { useTranslation } from "react-i18next";
import type { S23AssessmentReport } from "@exam-prep/contract";
import { formatCount, formatDuration, formatPercent, formatScore } from "@exam-prep/shared/format";
import { AiContent, Card, PageState, Stat, StatGroup, Tag } from "@exam-prep/ui";

export function ReportHero({ report }: { report: S23AssessmentReport }) {
  const { t } = useTranslation("S23");
  const s = report.summary;
  const incomplete = report.score_status === "incomplete";
  const comparison = report.score_status === "official" ? report.target_comparison : null;
  // feat:S23-01 R07 R21–R23：个人成绩与接口给出的可空目标比较；历史缓存中的群体字段也不展示。
  return (
    <Card
      className="s23-hero"
      tone="brand"
      title={report.title}
      meta={report.score_status === "provisional" ? <Tag tone="warning">{t("hero.provisional")}</Tag> : undefined}
    >
      {incomplete && (
        <PageState compact state="insufficient_data" title={t("state.insufficient_data.title")} body={t("state.insufficient_data.body")} />
      )}
      <StatGroup>
        <Stat
          label={t(incomplete ? "hero.raw_score" : "hero.score")}
          value={formatScore(s.score, { total: s.total })}
          tone="brand"
          hint={
            <>
              {typeof s.score_rate === "number" && (
                <span>
                  {t("hero.rate")} · {formatPercent(s.score_rate)}
                </span>
              )}
              {comparison && (
                <>
                  <br />
                  <span>{t("hero.target", { score: formatScore(comparison.target) })}</span>
                  <br />
                  <span>
                    {comparison.gap_kind === "on_target"
                      ? t("hero.on_target")
                      : t(`hero.${comparison.gap_kind}`, { score: formatScore(comparison.gap) })}
                  </span>
                </>
              )}
            </>
          }
        />
        <Stat
          label={t("hero.duration")}
          value={formatDuration(s.duration_minutes)}
          hint={t("hero.screens") + " · " + formatCount(s.screen_switches, t("unit.times"))}
        />
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
