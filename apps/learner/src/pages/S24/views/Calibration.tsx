import { useTranslation } from "react-i18next";
import type { S24Progress } from "@exam-prep/contract";
import { param } from "@exam-prep/params";
import { formatCount, formatDate, formatPercent, formatRange, formatScore } from "@exam-prep/shared/format";
import { AiContent, Button, Card, DataTable, Stat, StatGroup } from "@exam-prep/ui";

export function Calibration({ data, soon }: { data: S24Progress; soon: () => void }) {
  const { t } = useTranslation("S24");
  const { calibration } = data;
  const table = (
    <DataTable
      caption={t("calibration.personal")}
      stackOnNarrow
      rows={calibration.history}
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
  );
  return (
    <div className="flex flex-col gap-4">
      {/* feat:S24-17 往期公示与个人回填记录只读，登记操作尚未接后端；覆盖率目标取参数。 */}
      <Card title={t("calibration.global")} footer={t("calibration.note")}>
        <StatGroup>
          <Stat label={t("calibration.samples")} value={formatCount(calibration.samples)} />
          <Stat label={t("calibration.error")} value={formatScore(calibration.mean_error)} />
          <Stat
            label={t("calibration.coverage")}
            value={formatPercent(calibration.interval_coverage)}
            hint={t("calibration.target", { ratio: formatPercent(param("learner.forecast.coverage_target")) })}
          />
        </StatGroup>
      </Card>
      <Card title={t("calibration.personal")} actions={<Button onClick={soon}>{t("calibration.register")}</Button>}>
        {calibration.history.length > 0 ? <AiContent note={t("common.ai_note")}>{table}</AiContent> : table}
      </Card>
    </div>
  );
}
