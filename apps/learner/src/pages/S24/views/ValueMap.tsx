import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { param } from "@exam-prep/params";
import type { S24Point, S24Progress } from "@exam-prep/contract";
import { formatDuration, formatNumber, formatPercent, formatScore } from "@exam-prep/shared/format";
import { Banner, Button, Card, DataTable, Dialog, KeyValueList, Stat, StatGroup, Tag, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";
import { ForecastLock } from "../components/ForecastLock.tsx";
export function ValueMap({ data }: { data: S24Progress }) {
  const { t } = useTranslation("S24");
  const [reason, setReason] = useState<S24Point>();
  const jump = formatNumber(param("learner.forecast.max_tier_jump"), 0);
  if (data.map_check === "blocked") return <ForecastLock data={data} />;
  return (
    <div className="flex flex-col gap-4">
      {/* feat:S24-06 考情不足按重要度降级并明确标注。 */}
      {data.importance_estimated && <Banner tone="warning">{t("value.estimated")}</Banner>}
      {/* feat:S24-10 分值四段均取接口，不在页面合计。 */}
      <StatGroup>
        {data.score_bands.map((b) => (
          <Stat key={b.kind} label={t("value.bands." + b.kind)} value={formatScore(b.score)} />
        ))}
      </StatGroup>
      {/* feat:S24-04 */}
      <Card title={t("value.map")} meta={t("value.map_note")} footer={t("value.ladder_note", { levels: jump })}>
        <DataTable
          caption={t("value.map")}
          rows={data.points}
          rowKey={(r) => r.id}
          stackOnNarrow
          columns={[
            {
              key: "name",
              header: t("value.point"),
              label: t("value.point"),
              render: (r) => (
                <Link className="text-brand-primary underline" to={pathTo("S10", { kpId: r.id })}>
                  {r.name}
                </Link>
              ),
            },
            { key: "score", header: t("value.expected"), label: t("value.expected"), render: (r) => formatScore(r.expected_score) },
            {
              key: "probability",
              header: t("value.probability"),
              label: t("value.probability"),
              render: (r) => (data.importance_estimated ? t("value.estimated_short") : formatPercent(r.exam_probability)),
            },
            { key: "mastery", header: t("value.mastery"), label: t("value.mastery"), render: (r) => t("value.levels." + r.current_level) },
            {
              key: "difficulty",
              header: t("value.difficulty"),
              label: t("value.difficulty"),
              render: (r) => t("value.difficulty_values." + r.personal_difficulty),
            },
            { key: "time", header: t("value.minutes"), label: t("value.minutes"), render: (r) => formatDuration(r.minutes) },
            { key: "grade", header: t("value.grade"), label: t("value.grade"), render: (r) => <Tag>{r.roi_grade}</Tag> },
            { key: "rating", header: t("value.rating"), label: t("value.rating"), render: (r) => formatNumber(r.roi_score) },
          ]}
        />
      </Card>
      {/* feat:S24-05 */}
      <Card title={t("value.path")} meta={t("value.path_note")}>
        <ol className="flex flex-col gap-4">
          {data.path.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-3">
              <div>
                <p className="font-medium">
                  {t("value.rank", { rank: formatNumber(p.rank) })} · {p.name}
                </p>
                <p className="text-small text-ink-secondary">
                  {p.roi_grade} · {formatDuration(p.minutes)}
                </p>
              </div>
              <Button size="sm" onClick={() => setReason(p)}>
                {t("value.reason")}
              </Button>
            </li>
          ))}
        </ol>
      </Card>
      <Dialog
        open={reason !== undefined}
        onClose={() => setReason(undefined)}
        title={t("value.reason")}
        actions={<Button onClick={() => setReason(undefined)}>{t("common.close")}</Button>}
      >
        {reason && (
          <>
            <p className="font-medium">{reason.name}</p>
            <p>{reason.reason}</p>
            <KeyValueList
              items={[
                { key: "score", label: t("value.expected"), value: formatScore(reason.expected_score) },
                { key: "time", label: t("value.minutes"), value: formatDuration(reason.minutes) },
              ]}
            />
            <Link to={pathTo("S07")} className={buttonClass("secondary")}>
              {t("common.plan")}
            </Link>
          </>
        )}
      </Dialog>
    </div>
  );
}
