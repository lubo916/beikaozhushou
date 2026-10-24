import { useTranslation } from "react-i18next";
import { formatScore } from "@exam-prep/shared/format";

/** 差额（R06 R9）：接口给“目标分 − 最可能值”；不大于 0 时不显示负数，写“已过目标线”（判法同 formatTierGap）。 */
export function GapText({ gap, compact = false }: { gap: number; compact?: boolean }) {
  const { t } = useTranslation("S24");
  if (gap <= 0) return <>{t("forecast.reached")}</>;
  return <>{t(compact ? "overview.short" : "forecast.short", { value: formatScore(gap) })}</>;
}
