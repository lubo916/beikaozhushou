import { useTranslation } from "react-i18next";
import type { P01Cockpit } from "@exam-prep/contract";
import { formatCount, formatPercent } from "@exam-prep/shared";
import { BarList, Card, KeyValueList } from "@exam-prep/ui";

/** 比例是 0–1：条长按满格 1 画。 */
const FULL = 1;

// feat:P01-02 转化漏斗：从访问到付费的各步转化；步骤与口径以指标字典为准。样本不足时只列原始人数。
export function FunnelCard({ data }: { data: P01Cockpit }) {
  const { t } = useTranslation("P01");
  const measured = data.sample_sufficient && data.funnel.every((step) => step.ratio !== undefined);
  return (
    <Card title={t("funnel.title")} meta={t("funnel.meta", { version: data.dictionary_version })}>
      {measured ? (
        <BarList
          label={t("funnel.label")}
          max={FULL}
          items={data.funnel.map((step) => ({
            key: step.step_id,
            label: t(`funnel.steps.${step.step_id}`),
            value: step.ratio ?? 0,
            valueText: formatPercent(step.ratio ?? 0),
          }))}
        />
      ) : (
        <KeyValueList
          items={data.funnel.map((step) => ({
            key: step.step_id,
            label: t(`funnel.steps.${step.step_id}`),
            value: t("people", { n: formatCount(step.count) }),
          }))}
        />
      )}
    </Card>
  );
}
