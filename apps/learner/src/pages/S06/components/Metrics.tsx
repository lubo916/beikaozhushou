// 三个数（feat:S06-12 三个数常驻）：预测与差额（够不够）、完成度（走了多远）、健康度（来不来得及），各答一问，不互相代替（vocabulary 第 5 节）。
// 数都由接口算好，页面只显示，格式用统一函数（红线 5，ui-rules 第 9 节）。bk spec 布局：桌面在右栏最上面，平板在清单下面整张显示，
// 手机折叠成一行摘要；“详情”去进度与预测（S24）。只和某个数有关的数据不足、锁定只落在那个数上，其余照常（F08-Q1）：
// 数据不足不下结论，只给原始计数并说明还差什么；地图体检不通过时预测锁定，写明原因与“去修复”（去知识地图看体检，ui-rules 第 4 节）。
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S06Completion, S06Forecast, S06Health, S06Metrics, S06Shortfall } from "@exam-prep/contract";
import { formatCount, formatNumber, formatPercent, formatRange, formatScore } from "@exam-prep/shared/format";
import { Card, Stat, StatGroup, buttonClass, cx } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

/** 健康度与每天推进的档数最多显示两位小数（如 1.18、1.65）。 */
const PACE_DIGITS = 2;

interface Shown {
  readonly value: string;
  readonly hint: ReactNode;
}

interface ShownMetrics {
  readonly forecast: Shown;
  readonly completion: Shown;
  readonly health: Shown;
}

/** 把接口给的三个数变成要显示的取值与说明：只做显示格式、按状态选模板句，不算业务数字。 */
function useShown(metrics: S06Metrics): ShownMetrics {
  const { t } = useTranslation("S06");
  const insufficient = (key: string, shortfall: S06Shortfall | undefined): Shown => ({
    value: t("metrics.insufficient"),
    hint:
      shortfall === undefined
        ? t("metrics.insufficient_hint")
        : t(key, { have: formatCount(shortfall.have), missing: formatCount(shortfall.missing) }),
  });
  const change = (delta: number): string => {
    if (delta > 0) return t("metrics.forecast.change_up", { n: formatNumber(delta) });
    if (delta < 0) return t("metrics.forecast.change_down", { n: formatNumber(-delta) });
    return t("metrics.forecast.change_flat");
  };
  const forecast = (item: S06Forecast): Shown => {
    if (item.status === "locked") {
      return {
        value: t("metrics.locked"),
        hint: (
          <>
            {t("metrics.forecast.locked")}{" "}
            <Link to={pathTo("S09")} className={buttonClass("ghost", "sm")}>
              {t("metrics.fix")}
            </Link>
          </>
        ),
      };
    }
    if (item.status !== "ok" || item.low === undefined || item.high === undefined) {
      return insufficient("metrics.forecast.shortfall", item.shortfall);
    }
    const parts = [t("metrics.forecast.hint")];
    if (item.gap_to_target !== undefined) {
      parts.push(
        item.gap_to_target > 0
          ? t("metrics.forecast.gap_short", { gap: formatScore(item.gap_to_target) })
          : t("metrics.forecast.gap_reached"),
      );
    }
    if (item.week_change !== undefined) parts.push(change(item.week_change));
    return { value: formatRange(item.low, item.high), hint: parts.join(t("metrics.separator")) };
  };
  const completion = (item: S06Completion): Shown =>
    item.status === "ok" && item.ratio !== undefined
      ? { value: formatPercent(item.ratio), hint: t("metrics.completion.hint") }
      : { value: t("metrics.insufficient"), hint: t("metrics.completion.pending") };
  const health = (item: S06Health): Shown => {
    if (item.status !== "ok" || item.ratio === undefined) return insufficient("metrics.health.shortfall", item.shortfall);
    const hint =
      item.need_per_day === undefined || item.actual_per_day === undefined || item.recent_days === undefined
        ? t("metrics.health.name")
        : t("metrics.health.hint", {
            need: formatNumber(item.need_per_day, PACE_DIGITS),
            actual: formatNumber(item.actual_per_day, PACE_DIGITS),
            days: formatCount(item.recent_days),
          });
    return { value: formatNumber(item.ratio, PACE_DIGITS), hint };
  };
  return { forecast: forecast(metrics.forecast_gap), completion: completion(metrics.completion), health: health(metrics.health) };
}

/** “详情”：去进度与预测（路由表里的路径）。 */
function DetailLink({ className }: { className?: string | undefined }) {
  const { t } = useTranslation("S06");
  return (
    <Link to={pathTo("S24")} className={cx(buttonClass("ghost", "sm"), className)}>
      {t("metrics.detail")}
    </Link>
  );
}

/** 整张的三个数卡片（平板与桌面）。 */
export function MetricsCard({ metrics }: { metrics: S06Metrics }) {
  const { t } = useTranslation("S06");
  const shown = useShown(metrics);
  return (
    <Card title={t("metrics.title")} meta={t("metrics.meta")} actions={<DetailLink />}>
      {/* 原型里三个数上下排、各占一行；公共统计组默认自动分列，这里压成一列 */}
      <StatGroup className="grid-cols-1">
        <Stat label={t("metrics.forecast.question")} value={shown.forecast.value} hint={shown.forecast.hint} />
        <Stat label={t("metrics.completion.question")} value={shown.completion.value} hint={shown.completion.hint} />
        <Stat label={t("metrics.health.question")} value={shown.health.value} hint={shown.health.hint} />
      </StatGroup>
    </Card>
  );
}

/** 手机上折叠成的一行摘要：预测、完成度、健康度各一个数，加“详情”。 */
export function MetricsSummary({ metrics }: { metrics: S06Metrics }) {
  const { t } = useTranslation("S06");
  const shown = useShown(metrics);
  const items = [
    { key: "forecast", name: t("metrics.forecast.name"), value: shown.forecast.value },
    { key: "completion", name: t("metrics.completion.name"), value: shown.completion.value },
    { key: "health", name: t("metrics.health.name"), value: shown.health.value },
  ];
  return (
    <section
      aria-label={t("metrics.summary_label")}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-bg-surface px-4 py-3 text-small"
    >
      {items.map((item) => (
        <span key={item.key} className="flex items-baseline gap-1">
          <span className="text-ink-secondary">{item.name}</span>
          <span className="font-bold tabular-nums text-ink-primary">{item.value}</span>
        </span>
      ))}
      <DetailLink className="ml-auto" />
    </section>
  );
}
