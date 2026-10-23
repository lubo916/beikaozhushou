import { useTranslation } from "react-i18next";
import type { P02QualityCheck } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared";
import { AiContent, Card, KeyValueList, PageState } from "@exam-prep/ui";

// AI 做什么：识别埋点缺失与指标口径冲突，生成数据质量日报（服务指标字典，带 AI 标识）。样本不足时只给原始计数。
export function QualityCard({ quality }: { quality: P02QualityCheck }) {
  const { t } = useTranslation("P02");
  return (
    <Card title={t("quality.title")}>
      {quality.sample_sufficient ? (
        <div className="flex flex-col gap-3">
          <KeyValueList
            items={[
              {
                key: "conflicts",
                label: t("quality.conflicts"),
                value: t("quality.count", { n: formatCount(quality.conflict_count ?? 0) }),
              },
              {
                key: "missing",
                label: t("quality.missing"),
                value: t("quality.count", { n: formatCount(quality.missing_event_count ?? 0) }),
              },
              { key: "events", label: t("quality.events"), value: formatCount(quality.event_count) },
            ]}
          />
          {quality.summary !== undefined && <AiContent note={t("quality.aiNote")}>{quality.summary}</AiContent>}
        </div>
      ) : (
        <PageState
          compact
          state="insufficient_data"
          title={t("state.insufficient_data.title")}
          body={t("state.insufficient_data.body")}
          counts={[
            { key: "events", label: t("quality.events"), value: formatCount(quality.event_count) },
            { key: "minimum", label: t("quality.eventsMinimum"), value: formatCount(quality.minimum_event_count) },
          ]}
          missing={t("quality.insufficientMissing")}
        />
      )}
    </Card>
  );
}
