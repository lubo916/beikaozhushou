import type { S27SprintHome } from "@exam-prep/contract";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { formatCount, formatDays, formatDuration, formatPercent, formatTime } from "@exam-prep/shared/format";
import { AiContent, Banner, Button, Card, Columns, ProgressBar, ProposalCard, Tag, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";
import { Checklist } from "../components/Checklist.tsx";

export function SprintView({ data, soon }: { data: S27SprintHome; soon: () => void }) {
  const { t } = useTranslation("S27");
  return (
    <div className="flex flex-col gap-4" data-testid="S27-sprint">
      <Card title={t("sprint.timeline.title")}>
        <ol className="grid grid-cols-5 gap-2">
          {data.timeline.map((step) => (
            <li key={step.key} className="flex min-w-0 flex-col gap-1">
              <Tag tone={step.active ? "brand" : "neutral"} className="whitespace-normal">
                {step.key === "after"
                  ? t("views.after")
                  : step.key === "exam"
                    ? t("sprint.timeline.exam_day")
                    : t("sprint.timeline.before", { days: formatDays(step.days) })}
              </Tag>
              <strong>{t(`sprint.timeline.${step.key}`)}</strong>
              {step.active && <span>{t("sprint.timeline.current")}</span>}
            </li>
          ))}
        </ol>
      </Card>
      {/* feat:S27-01 仅展示待确认提议；写权限接通前不修改计划。 */}
      <ProposalCard
        title={t("proposal.title")}
        what={t("proposal.what", { ratio: formatPercent(data.proposal.consolidate_ratio) })}
        why={t("proposal.why", { days: formatDays(data.days_to_exam) })}
        cost={t("proposal.cost")}
        ifNot={t("proposal.if_not")}
        status={data.proposal.status}
        onConfirm={soon}
        onDecline={soon}
      />
      <p>{t(data.proposal.reminder_key)}</p>
      <Columns
        main={
          <div className="flex flex-col gap-4">
            {/* feat:S27-02 */}
            <Card title={t("sprint.today.title")} meta={t("sprint.today.meta")}>
              <ul className="ui-list ui-list--divided">
                {data.today.map((task) => (
                  <li key={task.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold">{t(`sprint.today.${task.key}.title`)}</h3>
                      <p>{t(`sprint.today.${task.key}.detail`)}</p>
                      <span>{formatDuration(task.minutes)}</span>
                    </div>
                    <Button size="sm" onClick={soon}>
                      {t(`sprint.today.${task.key}.action`)}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
            {/* feat:S27-07 */}
            <Card
              title={t("sprint.warmth.title")}
              actions={
                <Button size="sm" onClick={soon}>
                  {t("sprint.warmth.action")}
                </Button>
              }
            >
              <div className="flex flex-col gap-3">
                <p>{t("sprint.warmth.body")}</p>
                <ProgressBar
                  value={data.warmth.ratio}
                  label={t("sprint.warmth.progress")}
                  valueText={t("sprint.warmth.count", {
                    scanned: formatCount(data.warmth.scanned, t("unit.card")),
                    total: formatCount(data.warmth.total, t("unit.card")),
                  })}
                />
              </div>
            </Card>
          </div>
        }
        aside={
          <div className="flex flex-col gap-4">
            {/* feat:S27-08 feat:S27-12 */}
            <Card title={t("sprint.sleep.title")} footer={<Button onClick={soon}>{t("sprint.sleep.action")}</Button>}>
              <div className="flex flex-col gap-3">
                <strong>{t("sprint.sleep.time", { time: formatTime(data.exam_start, data.time_zone) })}</strong>
                <p>{t("sprint.sleep.body")}</p>
                <Banner>{t("sprint.sleep.tip")}</Banner>
              </div>
            </Card>
            <Checklist data={data} soon={soon} />
            {/* feat:S27-03 */}
            <Card title={t("sprint.quiet.title")}>
              <p>{t("sprint.quiet.body")}</p>
              <Link to={pathTo("S33")} className={buttonClass("ghost")}>
                {t("sprint.quiet.action")}
              </Link>
            </Card>
            {/* feat:S27-06 AI 筛选结果带标识；生成/打印未接权限，保持提示态。 */}
            <Card
              title={t("sprint.sheet.title")}
              meta={t("sprint.sheet.count", { total: formatCount(data.sheet.point_count) })}
              footer={
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={soon}>
                    {t("sprint.sheet.action")}
                  </Button>
                  <Link to={pathTo("S14")} className={buttonClass("secondary")}>
                    {t("sprint.sheet.open")}
                  </Link>
                </div>
              }
            >
              <div className="flex flex-col gap-3">
                <p>{t("sprint.sheet.body")}</p>
                <AiContent note={t("sprint.sheet.preview")}>
                  <ul className="list-disc pl-5">
                    {data.sheet.item_keys.map((key) => (
                      <li key={key}>{t(`sprint.sheet.${key}`)}</li>
                    ))}
                  </ul>
                </AiContent>
              </div>
            </Card>
          </div>
        }
      />
    </div>
  );
}
