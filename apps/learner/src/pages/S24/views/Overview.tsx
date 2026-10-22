import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { S24Progress } from "@exam-prep/contract";
import { formatDuration, formatNumber, formatPercent, formatRange, formatScore } from "@exam-prep/shared/format";
import { AiContent, Button, Card, Columns, DataTable, KeyValueList, Segmented, Stat, StatGroup } from "@exam-prep/ui";
import { ForecastLock } from "../components/ForecastLock.tsx";
import { Trend } from "../components/Trend.tsx";

export function Overview({ data, soon }: { data: S24Progress; soon: () => void }) {
  const { t } = useTranslation("S24");
  const [basis, setBasis] = useState<"workload" | "weighted">("workload");
  const [at, setAt] = useState<"today" | "target">("target");
  const forecast = data.forecasts[at];
  return (
    <div className="flex flex-col gap-4">
      {/* feat:S24-01 feat:S24-02 口径切换只选接口字段。 */}
      <Segmented
        label={t("metrics.basis")}
        value={basis}
        onChange={setBasis}
        options={["workload", "weighted"].map((value) => ({ value: value as typeof basis, label: t("metrics." + value) }))}
      />
      <StatGroup>
        <Stat
          label={t("metrics.forecast")}
          question={t("metrics.forecast_question")}
          value={
            data.map_check === "blocked" || !forecast ? "—" : formatRange(forecast.conservative, forecast.optimistic, t("common.score"))
          }
          hint={data.map_check === "blocked" ? t("state.restricted.title") : t("forecast." + at)}
          tone="brand"
        />
        <Stat
          label={t("metrics.completion")}
          question={t("metrics.completion_question")}
          value={formatPercent(data.metrics[basis])}
          hint={t("metrics.completion_note")}
          tone="brand"
        />
        <Stat
          label={t("metrics.health")}
          question={t("metrics.health_question")}
          value={formatPercent(data.metrics.health)}
          hint={t("metrics." + data.metrics.verdict)}
          tone="success"
        />
      </StatGroup>
      <p className="text-small text-ink-secondary">
        {t("metrics.pace", { actual: formatNumber(data.metrics.recent_daily), required: formatNumber(data.metrics.required_daily) })}
      </p>
      {/* feat:S24-03 feat:S24-07 feat:S24-19 体检阻断时预测与趋势均不渲染。 */}
      <Columns
        main={
          data.map_check === "blocked" ? (
            <ForecastLock data={data} />
          ) : (
            forecast && (
              <Card
                title={t("forecast.trend")}
                meta={t("forecast.trend_note")}
                actions={
                  <Segmented
                    label={t("forecast.basis")}
                    options={["today", "target"].map((value) => ({ value: value as typeof at, label: t("forecast." + value) }))}
                    value={at}
                    onChange={setAt}
                  />
                }
              >
                <Trend data={data} />
                <AiContent note={t("common.ai_note")}>
                  <KeyValueList
                    items={[
                      { key: "conservative", label: t("forecast.conservative"), value: formatScore(forecast.conservative) },
                      { key: "likely", label: t("forecast.likely"), value: formatScore(forecast.likely) },
                      { key: "optimistic", label: t("forecast.optimistic"), value: formatScore(forecast.optimistic) },
                      { key: "gap", label: t("forecast.gap"), value: formatScore(forecast.gap) },
                      { key: "pass", label: t("forecast.pass"), value: formatPercent(forecast.pass_probability) },
                    ]}
                  />
                </AiContent>
              </Card>
            )
          )
        }
        aside={
          <Card title={t("overview.time")} footer={<Button onClick={soon}>{t("overview.verify")}</Button>}>
            {/* feat:S24-08 有效与在场并列，补做检测保留入口。 */}
            <KeyValueList
              items={[
                { key: "effective", label: t("overview.effective"), value: formatDuration(data.time.effective_minutes) },
                { key: "present", label: t("overview.present"), value: formatDuration(data.time.present_minutes) },
                { key: "pending", label: t("overview.pending_time"), value: formatDuration(data.time.pending_minutes) },
              ]}
            />
            <p className="text-small text-ink-secondary">{t("overview.time_note")}</p>
          </Card>
        }
      />
      {/* feat:S24-11 feat:S24-13 */}
      <Card title={t("overview.subjects")}>
        <DataTable
          caption={t("overview.subjects")}
          stackOnNarrow
          rows={data.subjects}
          rowKey={(r) => r.id}
          columns={[
            { key: "name", header: t("overview.subject"), label: t("overview.subject"), render: (r) => r.name },
            {
              key: "completion",
              header: t("overview.completion"),
              label: t("overview.completion"),
              render: (r) => formatPercent(r.completion),
            },
            {
              key: "status",
              header: t("overview.status"),
              label: t("overview.status"),
              render: (r) => t(r.passed ? "overview.passed" : "overview.pending"),
            },
            {
              key: "suggested",
              header: t("overview.suggested"),
              label: t("overview.suggested"),
              render: (r) => formatDuration(r.suggested_minutes),
            },
            { key: "actual", header: t("overview.actual"), label: t("overview.actual"), render: (r) => formatDuration(r.actual_minutes) },
          ]}
        />
      </Card>
    </div>
  );
}
