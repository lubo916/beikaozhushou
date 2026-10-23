import { useTranslation } from "react-i18next";
import type { P01Cockpit, P01CohortDimension } from "@exam-prep/contract";
import { formatCount, formatPercent } from "@exam-prep/shared";
import { BarList, Card, KeyValueList, Segmented } from "@exam-prep/ui";
import { DIMENSIONS } from "../data.ts";

const FULL = 1;

interface RetentionCardProps {
  readonly data: P01Cockpit;
  readonly dimension: P01CohortDimension;
  readonly onDimension: (dimension: P01CohortDimension) => void;
}

// feat:P01-03 留存分群：按目标类型、地图来源、渠道切换；分群由接口按维度返回，样本不足的分群只给人数。
export function RetentionCard({ data, dimension, onDimension }: RetentionCardProps) {
  const { t } = useTranslation("P01");
  const retention = data.retention;
  const measured = retention.groups.filter((group) => group.sample_sufficient && group.ratio !== undefined);
  const thin = retention.groups.filter((group) => !group.sample_sufficient || group.ratio === undefined);
  return (
    <Card title={t("retention.title", { dimension: t(`retention.dimensions.${retention.dimension}`), day: retention.day })}>
      <div className="flex flex-col gap-3">
        <Segmented
          size="sm"
          label={t("retention.switch")}
          value={dimension}
          onChange={onDimension}
          options={DIMENSIONS.map((key) => ({ value: key, label: t(`retention.dimensions.${key}`) }))}
        />
        {measured.length > 0 && (
          <BarList
            label={t("retention.list")}
            max={FULL}
            items={measured.map((group) => ({
              key: group.group_id,
              label: t(`retention.groups.${group.group_id}`),
              value: group.ratio ?? 0,
              valueText: formatPercent(group.ratio ?? 0),
              tone: group.tone === "warning" ? ("warning" as const) : ("brand" as const),
            }))}
          />
        )}
        {thin.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-small text-ink-secondary">{t("retention.thinTitle")}</p>
            <KeyValueList
              items={thin.map((group) => ({
                key: group.group_id,
                label: t(`retention.groups.${group.group_id}`),
                value: t("people", { n: formatCount(group.cohort_size) }),
              }))}
            />
          </div>
        )}
        {retention.dimension === "map_source" && <p className="text-small text-ink-tertiary">{t("retention.notes.map_source")}</p>}
      </div>
    </Card>
  );
}
