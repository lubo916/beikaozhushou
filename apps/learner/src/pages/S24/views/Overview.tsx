import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { S24Forecast, S24Progress } from "@exam-prep/contract";
import { EMPTY_VALUE, formatDuration, formatPercent, formatRange, formatScore } from "@exam-prep/shared/format";
import { AiContent, Banner, Button, Card, Columns, DataTable, KeyValueList, Segmented, Stat, StatGroup } from "@exam-prep/ui";
import { ForecastLock } from "../components/ForecastLock.tsx";
import { GapText } from "../components/GapText.tsx";
import { HealthStat } from "../components/HealthStat.tsx";
import { ForecastDetails } from "../components/ForecastDetails.tsx";
import { Trend } from "../components/Trend.tsx";

/** 三个数里“够不够”的说明：按今天的水平、最可能值与离目标线的差额，证据不足时带低置信标记。 */
function ForecastHint({ forecast, blocked }: { forecast: S24Forecast | undefined; blocked: boolean }) {
  const { t } = useTranslation("S24");
  if (forecast === undefined) return <>{t(blocked ? "forecast.locked" : "forecast.none")}</>;
  return (
    <>
      {t("forecast.today_hint", { likely: formatScore(forecast.likely) })}
      <GapText gap={forecast.gap} />
      <ForecastDetails forecast={forecast} />
    </>
  );
}

/** 各科一行（R06 R4）：到了写“已过目标线”，没到写“差 N 分”；体检不通过时不给差额。 */
function SubjectStatus({ subject, blocked }: { subject: S24Progress["subjects"][number]; blocked: boolean }) {
  const { t } = useTranslation("S24");
  if (blocked || subject.gap === undefined) return <>{t("overview.locked")}</>;
  return subject.passed ? <>{t("forecast.reached")}</> : <GapText gap={subject.gap} compact />;
}

export function Overview({ data, soon }: { data: S24Progress; soon: () => void }) {
  const { t } = useTranslation("S24");
  const [basis, setBasis] = useState<"workload" | "weighted">("workload");
  const [at, setAt] = useState<"today" | "target">("today");
  const blocked = data.map_check === "blocked";
  // R06 R10a：三个数里的预测固定按今天的水平；走势卡里才能切到“按计划学到目标日”。
  const today = blocked ? undefined : data.forecasts.today;
  const shown = blocked ? undefined : data.forecasts[at];
  const { metrics } = data;
  return (
    <div className="flex flex-col gap-4">
      {/* feat:S24-01 feat:S24-02 口径切换只选接口字段。 */}
      <Segmented
        label={t("metrics.basis")}
        value={basis}
        onChange={setBasis}
        options={["workload", "weighted"].map((value) => ({ value: value as typeof basis, label: t("metrics." + value) }))}
      />
      {data.headline_subject !== undefined && (
        <p className="text-small text-ink-secondary">{t("metrics.subject", { subject: data.headline_subject })}</p>
      )}
      <StatGroup>
        <Stat
          label={t("metrics.forecast")}
          question={t("metrics.forecast_question")}
          value={today === undefined ? EMPTY_VALUE : formatRange(today.conservative, today.optimistic, t("common.score"))}
          hint={<ForecastHint forecast={today} blocked={blocked} />}
          tone="brand"
        />
        <Stat
          label={t("metrics.completion")}
          question={t("metrics.completion_question")}
          value={formatPercent(metrics[basis])}
          hint={t("metrics.completion_note")}
          tone="brand"
        />
        <HealthStat metrics={metrics} />
      </StatGroup>
      {/* feat:S24-03 feat:S24-07 feat:S24-19 体检阻断时预测、走势与差额都不渲染。 */}
      <Columns
        main={
          blocked ? (
            <ForecastLock data={data} />
          ) : (
            shown !== undefined && (
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
                {data.importance_estimated && <Banner tone="warning">{t("value.estimated")}</Banner>}
                <p className="text-small text-ink-secondary">{t("forecast.history_basis")}</p>
                <Trend data={data} />
                <AiContent note={t("common.ai_note")}>
                  <p className="font-medium">{t("forecast." + at)}</p>
                  <ForecastDetails forecast={shown} />
                  <KeyValueList
                    items={[
                      { key: "conservative", label: t("forecast.conservative"), value: formatScore(shown.conservative) },
                      { key: "likely", label: t("forecast.likely"), value: formatScore(shown.likely) },
                      { key: "optimistic", label: t("forecast.optimistic"), value: formatScore(shown.optimistic) },
                      { key: "target_line", label: t("forecast.target_line"), value: formatScore(shown.target_line) },
                      { key: "gap", label: t("forecast.gap"), value: <GapText gap={shown.gap} /> },
                      { key: "pass", label: t("forecast.pass"), value: formatPercent(shown.pass_probability) },
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
      {/* feat:S24-11 feat:S24-13 每科一行，写离目标线还差多少。 */}
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
              render: (r) => <SubjectStatus subject={r} blocked={blocked} />,
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
