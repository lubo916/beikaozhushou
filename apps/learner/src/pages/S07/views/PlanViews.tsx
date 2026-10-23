import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S07PlanOverview } from "@exam-prep/contract";
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatDuration,
  formatPercent,
  formatScore,
  formatTierGap,
} from "@exam-prep/shared/format";
import {
  AiBadge,
  Button,
  Card,
  Columns,
  DataTable,
  ProgressBar,
  ProposalCard,
  Stat,
  StatGroup,
  Tag,
  TaskGroup,
  TaskStrip,
  buttonClass,
} from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";
import type { PlanView } from "../data.ts";

type Props = { data: S07PlanOverview; soon: () => void; offline: boolean };

// feat:S07-06 feat:S07-07 feat:S07-08 feat:S07-09 feat:S07-14 feat:S07-19
export function Week({ data, soon, offline }: Props) {
  const { t } = useTranslation("S07");
  return (
    <Columns
      main={
        <Card title={t("week.title")} meta={t("week.range", { start: formatDate(data.week.start), end: formatDate(data.week.end) })}>
          <StatGroup>
            <Stat label={t("week.budget")} value={formatDuration(data.week.budget_minutes)} />
            <Stat label={t("week.scheduled")} value={formatDuration(data.week.scheduled_minutes)} />
            <Stat label={t("week.buffer")} value={formatDuration(data.week.buffer_minutes)} tone="brand" />
          </StatGroup>
          <div data-testid="week-grid" className="s07-week mt-4">
            {data.week.days.map((day) => (
              <section
                key={day.day}
                className={`s07-day${day.today ? " s07-day--today" : ""}${day.leave ? " s07-day--leave" : ""}`}
                aria-label={formatDate(day.day, { weekday: true })}
              >
                <header className="flex flex-wrap justify-between gap-1">
                  <strong>{formatDate(day.day, { weekday: true })}</strong>
                  <span className="text-small text-ink-secondary">{formatDuration(day.minutes)}</span>
                </header>
                {day.today && <Tag tone="brand">{t("week.today")}</Tag>}
                {day.leave && <Tag tone="warning">{t("week.leave")}</Tag>}
                <ul className="s07-items">
                  {day.items.map((item) => (
                    <li key={item.id} className={`s07-task s07-task--${item.segment}`}>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                      <span>{formatDuration(item.minutes)}</span>
                      {item.locked && <Tag size="sm">{t("week.locked")}</Tag>}
                      {item.institution && (
                        <Tag size="sm" tone="warning">
                          {t("week.institution")}
                        </Tag>
                      )}
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" disabled={offline} onClick={soon}>
                          {item.institution ? t("week.teacher") : item.locked ? t("week.unlock") : t("week.lock")}
                        </Button>
                        {!item.institution && (
                          <Button size="sm" variant="ghost" disabled={offline || item.locked} onClick={soon}>
                            {t("week.move")}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="mt-3 text-small text-ink-secondary">{t("week.rule")}</p>
          <p className="mt-2 text-small text-ink-secondary">{t("week.bufferHint")}</p>
        </Card>
      }
      aside={
        <div className="flex flex-col gap-4">
          <Card title={t("week.mix")}>
            <div className="flex flex-wrap gap-2">
              {(["roi", "review_first", "new_first"] as const).map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={data.plan.mix_mode === mode ? "primary" : "secondary"}
                  disabled={offline}
                  onClick={soon}
                >
                  {t(`week.${mode}`)}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-small text-ink-secondary">{t("week.mixHint")}</p>
          </Card>
          <Card title={t("week.addCourse")}>
            <p className="text-small text-ink-secondary">{t("week.institutionHint")}</p>
            <Button className="mt-3" disabled={offline} onClick={soon}>
              {t("week.addCourse")}
            </Button>
          </Card>
        </div>
      }
    />
  );
}

// feat:S07-04 feat:S07-05 feat:S07-17 范围三态与提议；不在前端计算工作量。
export function Scope({ data, soon, offline }: Props) {
  const { t } = useTranslation("S07");
  return (
    <div className="flex flex-col gap-4">
      <Card title={t("scope.title")}>
        <StatGroup>
          <Stat label={t("scope.completion")} question={t("scope.completionQuestion")} value={formatPercent(data.completion)} />
          <Stat
            label={t("scope.health")}
            question={t("scope.healthQuestion")}
            value={formatPercent(data.health)}
            hint={data.health_estimated ? t("scope.estimated") : undefined}
          />
        </StatGroup>
        <p className="my-3 text-small text-ink-secondary">{t("scope.description")}</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <Tag>{t("scope.defaultCount", { count: data.plan.scope_counts.default })}</Tag>
          <Tag tone="brand">{t("scope.addedCount", { count: data.plan.scope_counts.added })}</Tag>
          <Tag>{t("scope.removedCount", { count: data.plan.scope_counts.removed })}</Tag>
        </div>
        <DataTable
          caption={t("scope.title")}
          rows={data.scope}
          rowKey={(row) => row.id}
          stackOnNarrow
          columns={[
            {
              key: "name",
              header: t("scope.name"),
              label: t("scope.name"),
              render: (row) => (
                <>
                  <Link to={pathTo("S10", { kpId: row.id })} className="text-brand-primary">
                    {row.name}
                  </Link>
                  <p className="text-small text-ink-secondary">{row.chapter}</p>
                </>
              ),
            },
            {
              key: "state",
              header: t("scope.state"),
              label: t("scope.state"),
              render: (row) => <Tag tone={row.state === "added" ? "brand" : "neutral"}>{t(`scope.${row.state}`)}</Tag>,
            },
            { key: "target", header: t("scope.target"), label: t("scope.target"), render: (row) => row.target },
            { key: "gap", header: t("scope.gap"), label: t("scope.gap"), render: (row) => formatTierGap(row.gap) },
            { key: "minutes", header: t("scope.minutes"), label: t("scope.minutes"), render: (row) => formatDuration(row.minutes) },
            {
              key: "action",
              header: t("scope.action"),
              label: t("scope.action"),
              render: (row) => (
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" disabled={offline} onClick={soon}>
                    {row.state === "removed" ? t("scope.restore") : t("scope.remove")}
                  </Button>
                  {row.state === "default" && (
                    <Button size="sm" disabled={offline} onClick={soon}>
                      {t("scope.add")}
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
      {data.proposals.map((proposal) => (
        <fieldset key={proposal.id} disabled={offline} className="min-w-[0]">
          <ProposalCard
            title={t("scope.proposal")}
            status={proposal.status}
            what={proposal.change}
            why={proposal.reason}
            cost={proposal.cost}
            ifNot={proposal.if_declined}
            aiGenerated
            onConfirm={soon}
            onDecline={soon}
          />
        </fieldset>
      ))}
    </div>
  );
}

// feat:S07-18 每个排序因子来自接口。星标不影响优先级。
export function Ranking({ data }: Props) {
  const { t } = useTranslation("S07");
  return (
    <Card title={t("ranking.title")}>
      <p className="mb-3 text-small text-ink-secondary">{t("ranking.description")}</p>
      <DataTable
        caption={t("ranking.title")}
        rows={data.priorities}
        rowKey={(row) => row.id}
        stackOnNarrow
        columns={[
          { key: "rank", header: t("ranking.rank"), label: t("ranking.rank"), render: (row) => formatCount(row.rank) },
          {
            key: "name",
            header: t("ranking.name"),
            label: t("ranking.name"),
            render: (row) => (
              <Link to={pathTo("S10", { kpId: row.id })} className="text-brand-primary">
                {row.name}
              </Link>
            ),
          },
          { key: "score", header: t("ranking.score"), label: t("ranking.score"), render: (row) => formatScore(row.score) },
          {
            key: "frequency",
            header: t("ranking.frequency"),
            label: t("ranking.frequency"),
            render: (row) => (data.forecast_available ? row.frequency : t("sandbox.locked")),
          },
          { key: "gap", header: t("ranking.gap"), label: t("ranking.gap"), render: (row) => formatTierGap(row.gap) },
          { key: "prerequisite", header: t("ranking.prerequisite"), label: t("ranking.prerequisite"), render: (row) => row.prerequisite },
          { key: "minutes", header: t("ranking.minutes"), label: t("ranking.minutes"), render: (row) => formatDuration(row.minutes) },
          {
            key: "star",
            header: t("ranking.star"),
            label: t("ranking.star"),
            render: (row) => t(row.starred ? "ranking.yes" : "ranking.no"),
          },
        ]}
      />
    </Card>
  );
}

// feat:S07-06 feat:S07-10 重排记录只读；撤销在后端权限接通后执行。
export function Records({ data, soon, offline }: Props) {
  const { t } = useTranslation("S07");
  return (
    <Card title={t("log.title")}>
      <p className="mb-4 text-ink-secondary">{t("log.description")}</p>
      <ol className="flex flex-col gap-3">
        {data.records.map((record) => (
          <li key={record.id} className="rounded-sm border border-line-soft p-3">
            <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Tag>{t(`log.${record.source}`)}</Tag>
              <time dateTime={record.at} className="text-small text-ink-secondary">
                {formatDateTime(record.at, data.time_zone)}
              </time>
            </header>
            <p className="font-medium">{record.change}</p>
            <p className="mt-1 text-small">
              {t("log.reason")}：{record.reason}
            </p>
            <p className="mt-1 text-small">
              {t("log.cost")}：{record.cost}
            </p>
            {record.ai_generated && <AiBadge className="mt-2" />}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={soon}>
                {t("log.detail")}
              </Button>
              {record.undoable ? (
                <Button size="sm" disabled={offline} onClick={soon}>
                  {t("log.undo")}
                </Button>
              ) : (
                <Tag>{t("log.expired")}</Tag>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function ReviewCalendar({ data }: Props) {
  const { t } = useTranslation("S07");
  return (
    <Card title={t("calendar.title")}>
      <p className="mb-4 text-ink-secondary">{t("calendar.description")}</p>
      <div data-testid="review-calendar-grid" className="s07-week">
        {data.reviews.map((day) => (
          <section key={day.day} className={`s07-day${day.today ? " s07-day--today" : ""}`}>
            <strong>{formatDate(day.day, { weekday: true })}</strong>
            {day.today && <Tag tone="brand">{t("week.today")}</Tag>}
            <p className="font-medium">{t("calendar.count", { count: day.count })}</p>
            <p className="text-small text-ink-secondary">{formatDuration(day.minutes)}</p>
            <Link to={pathTo("S15")} className={buttonClass("secondary", "sm")}>
              {t("calendar.start")}
            </Link>
          </section>
        ))}
      </div>
    </Card>
  );
}

// feat:S07-11 feat:S07-12 feat:S07-15 自定轮次、总结和冲刺入口。
export function Rounds({ data, soon, offline }: Props) {
  const { t } = useTranslation("S07");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={soon} disabled={offline}>
          {t("timeline.add")}
        </Button>
        <Button onClick={soon} disabled={offline}>
          {t("timeline.sprint")}
        </Button>
      </div>
      {data.rounds.map((round) => (
        <Card
          key={round.id}
          title={round.name}
          meta={t(`timeline.${round.status}`)}
          actions={
            <>
              <Button size="sm" disabled={offline} onClick={soon}>
                {t("timeline.edit")}
              </Button>
              <Button size="sm" disabled={offline || round.status === "active"} onClick={soon}>
                {t("timeline.delete")}
              </Button>
            </>
          }
        >
          <p>
            {t("timeline.depth")}：{round.depth}
          </p>
          <p>
            {t("timeline.mix")}：{round.mix}
          </p>
          <p className="my-2 text-small text-ink-secondary">
            {t("timeline.condition")}：{round.condition}
          </p>
          <ProgressBar label={t("timeline.coverage")} value={round.coverage} valueText={formatPercent(round.coverage)} showLabel />
          {(round.status === "active" || round.status === "completed") && (
            <details className="mt-3">
              <summary className="cursor-pointer text-brand-primary">{t("timeline.summary")}</summary>
              <StatGroup>
                <Stat label={t("timeline.elapsed")} value={formatDuration(round.summary.minutes)} />
                <Stat label={t("timeline.achieved")} value={formatCount(round.summary.achieved_count, t("pointUnit"))} />
                <Stat label={t("timeline.reviews")} value={formatCount(round.summary.review_count, t("timesUnit"))} />
              </StatGroup>
              <p className="mt-2">
                {t("timeline.weakest")}：{round.summary.weakest_chapter}
              </p>
            </details>
          )}
        </Card>
      ))}
    </div>
  );
}

// feat:S07-01 今日层直接显示接口的三段清单。
export function Today({ data, soon }: Props) {
  const { t } = useTranslation("S07");
  return (
    <Card
      title={t("today.title")}
      actions={
        <Link to={pathTo("S06")} className={buttonClass("secondary")}>
          {t("today.open")}
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        {data.today.segments.map((group) => (
          <TaskGroup key={group.segment} segment={group.segment}>
            {group.tasks.map((task) => (
              <TaskStrip
                key={task.id}
                source={task.source}
                segment={task.segment}
                title={task.title}
                minutes={task.minutes}
                onStart={soon}
                startLabel={t("today.start")}
              />
            ))}
          </TaskGroup>
        ))}
      </div>
    </Card>
  );
}

export function PlanViews({ view, ...props }: Props & { view: PlanView }) {
  switch (view) {
    case "scope":
      return <Scope {...props} />;
    case "ranking":
      return <Ranking {...props} />;
    case "log":
      return <Records {...props} />;
    case "calendar":
      return <ReviewCalendar {...props} />;
    case "rounds":
      return <Rounds {...props} />;
    case "today":
      return <Today {...props} />;
    default:
      return <Week {...props} />;
  }
}
