import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S08Report } from "@exam-prep/contract";
import { formatCount, formatDate, formatDays, formatDuration, formatNumber, formatScore } from "@exam-prep/shared/format";
import { VOCAB } from "@exam-prep/shared/vocab";
import { AiContent, Card, DataTable, Stat, StatGroup, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

export function ReportData({ data }: { data: S08Report }) {
  const { t } = useTranslation("S08");
  const enough = data.availability !== "insufficient_data";
  const unit = (key: string) => t(`unit.${key}`);
  return (
    <div className="flex min-w-[0] flex-col gap-4" data-testid="s08-data">
      {/* feat:S08-01 固定结构报告；feat:S08-02 只展示接口的投入产出；feat:S08-05 只与自己比较。 */}
      <Card title={t("sections.summary")} tone="brand">
        {enough && (
          <AiContent>
            <p className="font-medium">{data.summary}</p>
          </AiContent>
        )}
        <StatGroup>
          <Stat label={t("metrics.effective_minutes")} value={formatDuration(data.metrics.effective_minutes)} />
          <Stat label={t("metrics.tier_gains")} value={formatCount(data.metrics.tier_gains, unit("tiers"))} />
          <Stat
            label={t("metrics.forecast_delta")}
            value={
              enough && data.forecast_available
                ? data.metrics.forecast_delta > 0
                  ? t("forecast_change", { score: formatScore(data.metrics.forecast_delta) })
                  : formatScore(data.metrics.forecast_delta)
                : "—"
            }
            hint={!data.forecast_available && enough ? t("forecast_locked") : undefined}
          />
        </StatGroup>
        {enough && (
          <p className="mt-3 text-small text-ink-secondary">
            {t("input_output", { duration: formatDuration(data.metrics.effective_minutes), gains: formatCount(data.metrics.tier_gains) })}
          </p>
        )}
      </Card>
      {enough && (
        <Card title={t("sections.highlights")}>
          <AiContent>
            <h3 className="font-medium text-status-success">{t("highlight")}</h3>
            <ul className="my-2 list-inside list-disc space-y-2">
              {data.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3 className="mt-3 font-medium text-status-warning">{t("improvement")}</h3>
            <p>{data.improvement}</p>
          </AiContent>
        </Card>
      )}
      {/* feat:S08-03 六档知识点数从期初到期末的变化，不在页面计算迁移。 */}
      {enough && (
        <Card
          title={t("sections.mastery")}
          actions={
            <Link to={pathTo("S09")} className={buttonClass("ghost", "sm")}>
              {t("links.map")}
            </Link>
          }
        >
          <DataTable
            caption={t("sections.mastery")}
            rows={data.mastery}
            rowKey={(row) => String(row.level)}
            columns={[
              {
                key: "level",
                header: t("sections.mastery"),
                render: (row) =>
                  VOCAB.mastery_level[
                    (["unlearned", "aware", "familiar", "mastered", "applying", "transferring"] as const)[row.level] ?? "unlearned"
                  ],
              },
              { key: "before", header: t("before"), render: (row) => formatCount(row.before, unit("items")) },
              { key: "after", header: t("after"), render: (row) => formatCount(row.after, unit("items")) },
            ]}
          />
        </Card>
      )}
      {/* feat:S08-07 读、看、听、练、背，每小时档位增量来自接口。 */}
      <Card title={t("sections.methods")}>
        {enough ? (
          <DataTable
            caption={t("sections.methods")}
            rows={data.methods}
            rowKey={(row) => row.key}
            columns={[
              { key: "method", header: t("sections.methods"), render: (row) => t(`method.${row.key}`) },
              { key: "minutes", header: t("duration"), render: (row) => formatDuration(row.minutes) },
              { key: "rate", header: t("rate"), render: (row) => t("efficiency", { gains: formatNumber(row.gains_per_hour) }) },
            ]}
          />
        ) : (
          <p className="text-ink-secondary">{t("raw_only")}</p>
        )}
      </Card>
      {/* feat:S08-12 节奏柱状图：柱高也由假数据接口预先给出。 */}
      <Card title={t("sections.rhythm")} meta={t("rhythm_days", { days: formatDays(data.metrics.active_days) })}>
        {data.rhythm.length === 0 ? (
          <p>{t("rhythm_empty")}</p>
        ) : (
          <ul aria-label={t("rhythm_axis")} className="flex items-end gap-2">
            {data.rhythm.map((item) => (
              <li key={item.day} className="flex min-w-[0] flex-1 flex-col items-center gap-2 text-center text-small">
                <span className="break-words text-ink-secondary">{formatDuration(item.minutes)}</span>
                <span className="flex h-12 w-full items-end rounded-sm bg-bg-sunk" aria-hidden="true">
                  <span className="w-full rounded-sm bg-brand-primary" style={{ height: `${item.height_percent}%` }} />
                </span>
                <span>{formatDate(item.day)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {/* feat:S08-13 提分来源；地图体检不通过不展示预测结论。 */}
      {enough && (
        <Card
          title={t("sections.sources")}
          footer={
            <Link to={pathTo("S24")} className={buttonClass("ghost", "sm")}>
              {t("links.progress")}
            </Link>
          }
        >
          {data.forecast_available ? (
            <>
              <ul className="space-y-3">
                {data.score_sources.map((source) => (
                  <li key={source.module} className="flex flex-wrap justify-between gap-2 border-b border-line-soft pb-2">
                    <span>
                      {source.module}
                      <small className="block text-ink-secondary">{source.action}</small>
                    </span>
                    <strong className={source.delta < 0 ? "text-status-danger" : "text-status-success"}>
                      {source.delta > 0 ? t("forecast_change", { score: formatScore(source.delta) }) : formatScore(source.delta)}
                    </strong>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-small text-ink-tertiary">{t("sources_note")}</p>
            </>
          ) : (
            <p>{t("forecast_locked")}</p>
          )}
        </Card>
      )}
      {/* feat:S08-08 新增、已毕业、顽固题三个数。 */}
      <Card title={t("sections.mistakes")}>
        <StatGroup>
          {(["new", "graduated", "stubborn"] as const).map((key) => (
            <Stat key={key} label={t(`mistake.${key}`)} value={formatCount(data.mistakes[key], unit("questions"))} />
          ))}
        </StatGroup>
      </Card>
      {/* feat:S08-11 轮次总结增加上一轮对比，其余周期结构一致。 */}
      {enough && data.view === "round" && (
        <Card title={t("sections.comparison")}>
          <DataTable
            caption={t("sections.comparison")}
            rows={data.comparison}
            rowKey={(row) => row.key}
            columns={[
              { key: "metric", header: t("sections.comparison"), render: (row) => t(`metrics.${row.key}`) },
              {
                key: "before",
                header: t("previous"),
                render: (row) => (row.key === "effective_minutes" ? formatDuration(row.before) : formatCount(row.before)),
              },
              {
                key: "after",
                header: t("current"),
                render: (row) => (row.key === "effective_minutes" ? formatDuration(row.after) : formatCount(row.after)),
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
