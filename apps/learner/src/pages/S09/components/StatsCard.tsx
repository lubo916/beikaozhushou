// 统计常驻（feat:S09-09）：已学、已达标、范围内、地图总数四个数同屏；数都由接口给，页面只按统一的计数格式显示。
import { useTranslation } from "react-i18next";
import type { S09Stats } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared/format";
import { Card, Stat, StatGroup } from "@exam-prep/ui";

export function StatsCard({ stats, className }: { readonly stats: S09Stats; readonly className?: string }) {
  const { t } = useTranslation("S09");
  const n = (value: number): string => formatCount(value);
  return (
    <Card className={className}>
      <StatGroup>
        <Stat
          label={t("stats.learned")}
          value={t("stats.value", { n: n(stats.learned), total: n(stats.total) })}
          hint={t("stats.learned_hint")}
        />
        <Stat
          label={t("stats.reached")}
          value={t("stats.value", { n: n(stats.reached), total: n(stats.in_scope) })}
          hint={t("stats.reached_hint")}
        />
      </StatGroup>
      <p className="s09-note s09-note--muted s09-gap-top">{t("stats.scope", { in_scope: n(stats.in_scope), total: n(stats.total) })}</p>
    </Card>
  );
}
