import { useTranslation } from "react-i18next";
import type { S25Calendar } from "@exam-prep/contract";
import { formatDate, formatDays, formatTime } from "@exam-prep/shared/format";
import { AiContent, Button, Card, DataTable, KeyValueList, PageState, Stat, StatGroup, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export function CalendarMain({ data }: { data: S25Calendar }) {
  const { t } = useTranslation("S25");
  const toast = useToast();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* feat:S25-03 两种倒计时均由接口提供，不在页面按日期计算。 */}
      <Card>
        <StatGroup>
          <Stat label={t("nearest")} value={formatDays(data.nearest_days)} tone="brand" />
          <Stat
            label={t("target")}
            value={formatDays(data.target_days)}
            hint={t("target_on", { date: formatDate(data.target_date, { year: true }) })}
          />
        </StatGroup>
      </Card>
      {/* feat:S25-01 多目标时间线；feat:S25-05 预计日期逐条显示依据。 */}
      <Card title={t("timeline")}>
        <ol className="flex flex-col gap-4">
          {data.events.map((event) => (
            <li key={event.id} className="border-l-2 border-line-soft pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="tabular-nums">{formatDate(event.date, { year: true, weekday: true })}</strong>
                <Tag tone={event.status === "estimated" ? "warning" : event.status === "custom" ? "brand" : "success"}>
                  {t(`status.${event.status}`)}
                </Tag>
              </div>
              <h3 className="font-medium">{event.title}</h3>
              <p className="text-small text-ink-secondary">{t("for_target", { target: event.target })}</p>
              <p className="text-small text-ink-tertiary">{t("basis", { basis: event.basis })}</p>
            </li>
          ))}
        </ol>
      </Card>
      {/* feat:S25-02 同日多场与分天科目，按接口排好的顺序展示。 */}
      <Card title={t("sessions")} flush>
        <DataTable
          caption={t("sessions")}
          stackOnNarrow
          rowKey={(row) => row.id}
          rows={data.sessions}
          columns={[
            { key: "subject", header: t("detail.subjects"), label: t("detail.subjects"), render: (row) => <strong>{row.subject}</strong> },
            { key: "date", header: t("session_date"), label: t("session_date"), render: (row) => formatDate(row.date, { weekday: true }) },
            {
              key: "time",
              header: t("session_slot"),
              label: t("session_slot"),
              render: (row) =>
                t("session_time", { start: formatTime(row.start_at, data.timezone), end: formatTime(row.end_at, data.timezone) }),
            },
            { key: "location", header: t("session_location"), label: t("session_location"), render: (row) => row.location },
          ]}
        />
      </Card>
      {/* feat:S25-06 公告监测：来源、原文和人工核验状态；feat:S25-07 变化影响只形成待确认提议。 */}
      <Card title={t("announcements")}>
        <div className="flex flex-col gap-4">
          {data.announcements.map((notice) => (
            <article key={notice.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Tag tone={notice.verified ? "success" : "warning"}>{t(notice.verified ? "verified" : "unverified")}</Tag>
                <span className="text-small text-ink-tertiary">{formatDate(notice.published_on, { year: true })}</span>
              </div>
              <h3 className="font-medium">{notice.title}</h3>
              <p>{notice.summary}</p>
              <p className="text-small text-ink-secondary">{t("source", { source: notice.source })}</p>
              <a className={buttonClass("secondary", "sm")} href={notice.url} target="_blank" rel="noreferrer">
                {t("original")}
              </a>
              {notice.ai_generated ? (
                <AiContent note={t("meaning")}>
                  <p>{notice.impact}</p>
                </AiContent>
              ) : (
                <p>{notice.impact}</p>
              )}
              {notice.plan_proposal && (
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone="warning">{t("pending")}</Tag>
                  <Button size="sm" onClick={() => toast(t("soon_proposal"))}>
                    {t("proposal")}
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function CalendarAside({ data, restricted }: { data: S25Calendar; restricted: boolean }) {
  const { t } = useTranslation("S25");
  const toast = useToast();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* feat:S25-10 完整考试详情与官网；沿用公共考试画像名称。 */}
      <Card title={t("details")} meta={data.exam.name}>
        <KeyValueList
          items={(["authority", "requirements", "subjects", "question_types", "standard", "validity"] as const).map((key) => ({
            key,
            label: t(`detail.${key}`),
            value: data.details[key],
          }))}
        />
        <a className={buttonClass("secondary", "sm")} href={data.details.official_url} target="_blank" rel="noreferrer">
          {t("official")}
        </a>
      </Card>
      {/* feat:S25-04 递进提醒与考试当天考务模式；短信受限只落在本卡片。 */}
      <Card
        title={t("reminders")}
        actions={
          <Button size="sm" onClick={() => toast(t("soon_reminder"))}>
            {t("configure")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <p>{t("reminder_before", { days: data.reminders.offset_days.map(formatDays).join("、") })}</p>
          <div className="flex flex-wrap gap-2">
            {data.reminders.channels.map((channel) => (
              <Tag key={channel} tone="brand">
                {t(`channels.${channel}`)}
              </Tag>
            ))}
          </div>
          {data.reminders.exam_day_only && <p className="text-small text-ink-secondary">{t("exam_day")}</p>}
          {(restricted || !data.reminders.sms_bound) && (
            <PageState
              state="restricted"
              compact
              title={t("state.restricted.title")}
              body={t("state.restricted.body")}
              action={
                <Button size="sm" onClick={() => toast(t("soon"))}>
                  {t("bind")}
                </Button>
              }
            />
          )}
        </div>
      </Card>
      {/* feat:S25-08 滚动成绩周期和临期标记均由接口返回。 */}
      <Card title={t("validity")}>
        {data.validity.length === 0 ? (
          <p className="text-small text-ink-secondary">{t("no_validity")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.validity.map((record) => (
              <li key={record.id}>
                <strong>{record.subject}</strong>
                {record.warning && <Tag tone="warning">{t("expiring")}</Tag>}
                <p>{t("expiry", { date: formatDate(record.expires_on, { year: true }) })}</p>
                <p className="text-small text-ink-secondary">{record.note}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {/* feat:S25-09 证件、文具、禁带物品、路线清单；未接写操作时不会假称已保存。 */}
      <Card title={t("checklist")} meta={t("checklist_hint")}>
        <ul className="flex flex-col gap-4">
          {data.checklist.map((item) => (
            <li key={item.id} className="flex flex-col items-start gap-2">
              <div className="flex flex-wrap gap-2">
                <strong>{t(`category.${item.category}`)}</strong>
                <Tag tone={item.checked ? "success" : "outline"}>{t(item.checked ? "checked" : "unchecked")}</Tag>
              </div>
              <p className="text-small text-ink-secondary">{item.content}</p>
              <Button size="sm" onClick={() => toast(t("soon"))}>
                {t("check", { category: t(`category.${item.category}`) })}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      {/* feat:S25-11 按相关度给开放域积累素材，未挂载时不显示。 */}
      {data.accumulation.length > 0 && (
        <Card title={t("accumulation")}>
          <div className="flex flex-col gap-4">
            {data.accumulation.map((item) => (
              <article key={item.id} className="flex flex-col gap-2">
                <h3 className="font-medium">{item.title}</h3>
                <p className="text-small text-ink-secondary">{item.relevance}</p>
                <a className="text-brand-primary underline" href={item.url} target="_blank" rel="noreferrer">
                  {t("source", { source: item.source })}
                </a>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => toast(t("soon"))}>
                    {t("material")}
                  </Button>
                  <Button size="sm" onClick={() => toast(t("soon"))}>
                    {t("card")}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
