import { useTranslation } from "react-i18next";
import type { P01Cockpit, P01CohortDimension } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared";
import { Card, Columns, PageState } from "@exam-prep/ui";
import { AlertsCard } from "./AlertsCard.tsx";
import { FunnelCard } from "./FunnelCard.tsx";
import { NorthStarStats } from "./NorthStarStats.tsx";
import { RetentionCard } from "./RetentionCard.tsx";

interface CockpitContentProps {
  readonly data: P01Cockpit;
  readonly dimension: P01CohortDimension;
  readonly onDimension: (dimension: P01CohortDimension) => void;
  readonly onHandle: () => void;
}

/** 正常态与数据不足态的正文：北极星一行，下面左栏留存与漏斗、右栏告警（容器 ≥ 860 时分两栏）。 */
export function CockpitContent({ data, dimension, onDimension, onHandle }: CockpitContentProps) {
  const { t } = useTranslation("P01");
  return (
    <div className="flex flex-col gap-4">
      {!data.sample_sufficient && (
        <Card>
          <PageState
            compact
            state="insufficient_data"
            title={t("state.insufficient_data.title")}
            body={t("state.insufficient_data.body")}
            counts={[
              { key: "sample", label: t("insufficient.sample"), value: t("people", { n: formatCount(data.sample_count) }) },
              { key: "minimum", label: t("insufficient.minimum"), value: t("people", { n: formatCount(data.minimum_sample_size) }) },
            ]}
            missing={t("insufficient.missing")}
          />
        </Card>
      )}
      <NorthStarStats data={data} />
      <Columns
        main={
          <>
            <RetentionCard data={data} dimension={dimension} onDimension={onDimension} />
            <FunnelCard data={data} />
          </>
        }
        aside={<AlertsCard data={data} onHandle={onHandle} />}
      />
    </div>
  );
}
