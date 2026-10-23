import { useTranslation } from "react-i18next";
import type { P01Cockpit } from "@exam-prep/contract";
import { formatCount, formatPercent } from "@exam-prep/shared";
import { Card, Stat } from "@exam-prep/ui";
import { Link } from "../../../router/history.tsx";
import { pathTo } from "../../../routes.ts";

const CHANGE_DIGITS = 1;

export function NorthStarStats({ data }: { data: P01Cockpit }) {
  const { t } = useTranslation("P01");
  const star = data.north_star;
  const change = star.change_ratio;
  const rate = data.first_week_rate;
  const hint =
    change === undefined
      ? t("northStar.previous", { n: formatCount(star.previous_value) })
      : change > 0
        ? t("northStar.up", { change: formatPercent(change, CHANGE_DIGITS) })
        : change < 0
          ? t("northStar.down", { change: formatPercent(Math.abs(change), CHANGE_DIGITS) })
          : t("northStar.flat");
  return (
    <section aria-label={t("northStar.section")} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-4">
        {/* feat:P01-01 北极星：周有效学习用户数；目标值待确认时不着色，口径以指标字典为准 */}
        <Card>
          <Stat label={t("northStar.label")} value={formatCount(star.value)} hint={hint} />
        </Card>
        {/* feat:P01-02 新用户首周有效学习率（漏斗末段转化）；样本不足时只给原始计数 */}
        <Card>
          <Stat
            label={t("firstWeek.label")}
            value={rate.ratio === undefined ? formatCount(rate.numerator) : formatPercent(rate.ratio)}
            hint={t("firstWeek.hint", { effective: formatCount(rate.numerator), n: formatCount(rate.denominator) })}
          />
        </Card>
      </div>
      <p className="text-small text-ink-tertiary">
        {star.target_status === "confirmed" && star.target_value !== undefined
          ? t("northStar.target", { value: formatCount(star.target_value) })
          : t("northStar.targetPending")}{" "}
        <Link to={pathTo("P02")} className="text-brand-primary underline">
          {t("northStar.dictionary", { version: data.dictionary_version })}
        </Link>
      </p>
    </section>
  );
}
