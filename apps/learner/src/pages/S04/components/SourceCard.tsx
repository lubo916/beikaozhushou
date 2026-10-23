// 题从哪来（feat:S04-06 题源与可信度）：优先一级审定题，其次二级自有题；都不足时改用快速定位或先导入题目。
// 可信度的叫法用术语表（credibilityLabel）；门槛数由接口给（参数 learner.diagnosis.min_pool_items，红线 2）。
import { useTranslation } from "react-i18next";
import { credibilityLabel } from "@exam-prep/shared/vocab";
import { Card } from "@exam-prep/ui";
import { InfoList } from "./InfoList.tsx";

export function SourceCard({ minPool }: { readonly minPool: number }) {
  const { t } = useTranslation("S04");
  const rows = [
    { key: "reviewed", title: t("source.level", { label: credibilityLabel("reviewed") }), body: t("source.reviewed") },
    { key: "own", title: t("source.level", { label: credibilityLabel("own") }), body: t("source.own") },
    { key: "short", title: t("source.short_title", { n: minPool }), body: t("source.short_body") },
  ];
  return (
    <Card title={t("source.title")}>
      <InfoList rows={rows} />
    </Card>
  );
}
