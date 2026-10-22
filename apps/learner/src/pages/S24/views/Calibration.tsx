import { useTranslation } from "react-i18next";
import type { S24Progress } from "@exam-prep/contract";
import { formatCount, formatDate, formatPercent, formatRange, formatScore } from "@exam-prep/shared/format";
import { Button, Card, DataTable, Stat, StatGroup } from "@exam-prep/ui";
export function Calibration({ data, soon }: { data: S24Progress; soon: () => void }) {
  const { t } = useTranslation("S24");
  return (
    <div className="flex flex-col gap-4">
      {/* feat:S24-17 往期公示与个人回填记录只读，登记操作尚未接后端。 */}
      <Card title={t("calibration.global")} footer={t("calibration.note")}>
        <StatGroup>
          <Stat label={t("calibration.samples")} value={formatCount(data.calibration.samples)} />
          <Stat label={t("calibration.error")} value={formatScore(data.calibration.mean_error)} />
          <Stat label={t("calibration.coverage")} value={formatPercent(data.calibration.interval_coverage)} />
        </StatGroup>
      </Card>
      <Card title={t("calibration.personal")} actions={<Button onClick={soon}>{t("calibration.register")}</Button>}>
        <DataTable
          caption={t("calibration.personal")}
          stackOnNarrow
          rows={data.calibration.history}
          rowKey={(r) => r.day}
          empty={t("calibration.empty")}
          columns={[
            { key: "date", header: t("calibration.date"), label: t("calibration.date"), render: (r) => formatDate(r.day) },
            { key: "exam", header: t("calibration.exam"), label: t("calibration.exam"), render: (r) => r.label },
            {
              key: "forecast",
              header: t("calibration.predicted"),
              label: t("calibration.predicted"),
              render: (r) => formatRange(r.low, r.high, t("common.score")),
            },
            { key: "actual", header: t("calibration.actual"), label: t("calibration.actual"), render: (r) => formatScore(r.actual) },
          ]}
        />
      </Card>
    </div>
  );
}
