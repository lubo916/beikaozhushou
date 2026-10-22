import { useTranslation } from "react-i18next";
import type { S24Forecast } from "@exam-prep/contract";
import { formatPercent, formatScore } from "@exam-prep/shared/format";
import { Tag } from "@exam-prep/ui";
/** 置信度、估计占比和较上周均来自接口；页面不计算区间或比较历史记录。 */
export function ForecastDetails({ forecast }: { forecast: S24Forecast }) {
  const { t } = useTranslation("S24");
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Tag tone={forecast.confidence === "low" ? "warning" : "neutral"}>{t("forecast.confidence." + forecast.confidence)}</Tag>
      {forecast.estimated_score_ratio > 0 && (
        <span>{t("forecast.estimated_share", { ratio: formatPercent(forecast.estimated_score_ratio) })}</span>
      )}
      {forecast.weekly_change !== undefined && (
        <span>{t("forecast.weekly_change", { value: (forecast.weekly_change > 0 ? "+" : "") + formatScore(forecast.weekly_change) })}</span>
      )}
    </span>
  );
}
