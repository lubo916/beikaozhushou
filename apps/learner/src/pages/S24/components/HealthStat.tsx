import { useTranslation } from "react-i18next";
import type { S24Progress } from "@exam-prep/contract";
import { EMPTY_VALUE, formatCount, formatNumber } from "@exam-prep/shared/format";
import { Stat } from "@exam-prep/ui";
const DIGITS = 2;
const TONE = { ok: "success", tight: "warning", short: "danger" } as const;
/** feat:S24-02 R06 R22：只展示接口判定的状态；没有样本时不给比值或判词。 */
export function HealthStat({ metrics }: { metrics: S24Progress["metrics"] }) {
  const { t } = useTranslation("S24");
  if (metrics.health_state !== "normal" || metrics.health === undefined || metrics.verdict === undefined) {
    const state = metrics.health_state === "normal" ? "insufficient_data" : metrics.health_state;
    const raw =
      state === "insufficient_data" && metrics.observed_days !== undefined && metrics.advanced_levels !== undefined
        ? t("metrics.health_raw", { days: formatCount(metrics.observed_days), levels: formatCount(metrics.advanced_levels) })
        : t("metrics.health_reason." + state);
    return (
      <Stat
        label={t("metrics.health")}
        question={t("metrics.health_question")}
        value={state === "target_passed" || state === "no_available_days" ? EMPTY_VALUE : t("metrics.health_state." + state)}
        hint={raw}
        tone={state === "all_reached" ? "success" : "warning"}
      />
    );
  }
  return (
    <Stat
      label={t("metrics.health")}
      question={t("metrics.health_question")}
      value={formatNumber(metrics.health, DIGITS)}
      hint={t("metrics.health_hint", {
        verdict: t("metrics.verdict." + metrics.verdict),
        required: metrics.required_daily === undefined ? EMPTY_VALUE : formatNumber(metrics.required_daily, DIGITS),
        actual: metrics.recent_daily === undefined ? EMPTY_VALUE : formatNumber(metrics.recent_daily, DIGITS),
      })}
      tone={TONE[metrics.verdict]}
    />
  );
}
