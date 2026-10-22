// S35 消息与帮助：本页没有额外视图；通知筛选与详情弹窗只改变显示，不在页面计算业务规则。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { formatDateTime, formatNumber } from "@exam-prep/shared/format";
import {
  AiContent,
  Banner,
  Button,
  Card,
  Columns,
  ContainerScope,
  Dialog,
  FilterChips,
  PageHeader,
  PageState,
  Skeleton,
  Tag,
  buttonClass,
} from "@exam-prep/ui";
import type { S35Notification, S35Ticket } from "@exam-prep/contract";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { useMessages } from "./data.ts";

type Category = "all" | S35Notification["category"];
type Panel = "announcement" | "feedback" | "human" | "push" | "ai" | null;

export default function Page() {
  const { t } = useTranslation("S35");
  const toast = useToast();
  const home = useMessages();
  const location = useLocation();
  const [search] = useSearchParams();
  const [category, setCategory] = useState<Category>("all");
  const [panel, setPanel] = useState<Panel>(null);
  const [ticket, setTicket] = useState<S35Ticket | null>(null);
  const [question, setQuestion] = useState("");
  const [feedback, setFeedback] = useState("");
  const [validation, setValidation] = useState(false);
  // feat:S35-11 从订单、退款或支付失败入口带入订单号；它作为展示上下文，不用于信任与权限判断。
  const orderId = search.get("order_id") ?? search.get("orderId") ?? "";
  const source = search.get("from") ?? search.get("source") ?? location.pathname;
  const data = home.data;
  const close = () => {
    setPanel(null);
    setValidation(false);
  };
  const soon = (key: string) => toast(t(`soon.${key}`));
  const title = <PageHeader title={t("title")} description={t("description")} meta={<Tag>{t("sample")}</Tag>} />;

  if (home.state === "loading")
    return (
      <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
        <PageState
          state="loading"
          pageName={t("title")}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={
            <div className="flex flex-col gap-4">
              <Skeleton title lines={2} />
              <Columns main={<Skeleton title lines={5} block />} aside={<Skeleton title lines={5} block />} />
            </div>
          }
        />
      </ContainerScope>
    );
  if (home.state === "offline" && data === undefined)
    return (
      <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
        {title}
        <PageState
          state="offline"
          pageName={t("title")}
          title={t("state.offline.title")}
          body={t("state.offline.no_cache")}
          action={<Button onClick={home.retry}>{t("state.offline.retry")}</Button>}
        />
      </ContainerScope>
    );
  if (home.state === "restricted" && data === undefined)
    return (
      <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
        {title}
        <PageState
          state="restricted"
          pageName={t("title")}
          title={t("state.restricted.title")}
          body={t("state.restricted.body")}
          action={
            <Link className={buttonClass("secondary")} to={pathTo("S33")}>
              {t("notification.settings")}
            </Link>
          }
        />
      </ContainerScope>
    );
  if (home.state === "error" || data === undefined)
    return (
      <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
        {title}
        <PageState
          state="error"
          pageName={t("title")}
          title={t("state.error.title")}
          body={t("state.error.body")}
          onRetry={home.retry}
          onReport={() => soon("report")}
        />
      </ContainerScope>
    );

  const categories: readonly Category[] = ["all", "review", "node", "completion", "security"];
  const shown = data.notifications.filter((item) => category === "all" || item.category === category);
  const order = orderId || ticket?.order_id || "";
  const feedbackContext = (
    <dl className="ui-kv">
      <div className="ui-kv__row">
        <dt>{t("service.current_page")}</dt>
        <dd>{t("title")}</dd>
      </div>
      <div className="ui-kv__row">
        <dt>{t("service.source_page")}</dt>
        <dd className="break-all">{source}</dd>
      </div>
      <div className="ui-kv__row">
        <dt>{t("service.order")}</dt>
        <dd className="break-all">{order || t("service.no_order")}</dd>
      </div>
    </dl>
  );

  // feat:S35-02 触达纪律来自接口参数；只展示，不在页面控制频率或计算额度。
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      {title}
      {home.stale && (
        <Banner
          tone="warning"
          title={t("state.offline.stale")}
          action={
            <Button size="sm" onClick={home.retry}>
              {t("state.offline.retry")}
            </Button>
          }
        >
          {t("state.offline.body")}
        </Banner>
      )}
      {/* feat:S35-07 系统公告横幅与详情 */}
      <Banner
        title={data.announcement.title}
        action={
          <Button size="sm" variant="secondary" onClick={() => setPanel("announcement")}>
            {t("announcement.detail")}
          </Button>
        }
      >
        {data.announcement.body}
      </Banner>
      <Columns
        main={
          <div className="flex min-w-0 flex-col gap-4">
            {/* feat:S35-01 通知分类，每条通知直达对应处理页面。 */}
            <Card
              title={t("notification.title")}
              actions={
                <Link className={buttonClass("ghost", "sm")} to={pathTo("S33")}>
                  {t("notification.settings")}
                </Link>
              }
            >
              <div className="flex flex-col gap-4">
                <FilterChips
                  label={t("notification.filter")}
                  multiple={false}
                  options={categories.map((value) => ({ value, label: t(`notification.${value}`) }))}
                  selected={[category]}
                  onChange={(values) => setCategory(values[0] ?? "all")}
                />
                <p className="text-small text-ink-secondary">{t("notification.discipline", { cap: formatNumber(data.daily_cap) })}</p>
                {/* feat:S35-05 免打扰与延后送达原因 */}
                <p className="text-small text-ink-tertiary">
                  {t("notification.quiet", { start: data.quiet_hours[0], end: data.quiet_hours[1] })}
                </p>
                {home.state === "empty" ? (
                  <PageState
                    state="empty"
                    pageName={t("title")}
                    title={t("state.empty.title")}
                    body={t("state.empty.body", { cap: formatNumber(data.daily_cap) })}
                    action={
                      <Link className={buttonClass("primary")} to={pathTo("S33")}>
                        {t("state.empty.action")}
                      </Link>
                    }
                  />
                ) : shown.length === 0 ? (
                  <p role="status" className="text-ink-tertiary">
                    {t("notification.no_match")}
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line-soft">
                    {shown.map((item) => (
                      <li key={item.id} className="flex flex-col gap-2 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Tag>{t(`notification.${item.category}`)}</Tag>
                          <Tag tone={item.unread ? "brand" : "neutral"}>{t(item.unread ? "notification.unread" : "notification.read")}</Tag>
                          {item.delayed && <Tag tone="warning">{t("notification.delayed")}</Tag>}
                        </div>
                        <h3 className="font-medium">{item.title}</h3>
                        <p className="text-ink-secondary">{item.body}</p>
                        <time className="text-small text-ink-tertiary" dateTime={item.created_at}>
                          {formatDateTime(item.created_at, data.time_zone)}
                        </time>
                        <div className="flex flex-wrap gap-2">
                          <Link className={buttonClass("secondary", "sm")} to={pathTo(item.target)}>
                            {t("notification.open")}
                          </Link>
                          {item.unread && (
                            <Button size="sm" variant="ghost" onClick={() => soon("read")}>
                              {t("notification.mark")}
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
            {/* feat:S35-06 先说明价值再申请权限；当前写权限未登记，只提示即将上线。 */}
            <Card title={t("push.title")}>
              <p className="text-ink-secondary">{t("push.body")}</p>
              {data.push_enabled ? (
                <p className="mt-2 text-small text-status-success">{t("push.enabled")}</p>
              ) : (
                <PageState state="restricted" pageName={t("title")} title={t("state.restricted.title")} body={t("state.restricted.body")} />
              )}
              <Button className="mt-4" variant="secondary" onClick={() => setPanel("push")}>
                {t("push.action")}
              </Button>
            </Card>
            {data.insufficient_data && (
              <PageState
                state="insufficient_data"
                pageName={t("title")}
                title={t("state.insufficient_data.title")}
                body={t("state.insufficient_data.body")}
              />
            )}
          </div>
        }
        aside={
          <div className="flex min-w-0 flex-col gap-4">
            {/* feat:S35-03 帮助反馈自动带上下文，可查处理进度。feat:S35-10 显示人工工作时间、联系方式与非工作时间留言规则。 */}
            <Card title={t("service.title")}>
              <div className="flex flex-col gap-3">
                <p className="text-ink-secondary">{t("service.intro")}</p>
                <label className="flex flex-col gap-2">
                  {t("service.question")}
                  <textarea
                    className="w-full rounded-sm border border-line-strong bg-bg-surface p-3 text-body"
                    rows={3}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder={t("service.placeholder")}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setPanel("ai")}>{t("service.ask")}</Button>
                  <Button variant="secondary" onClick={() => setPanel("human")}>
                    {t("service.human")}
                  </Button>
                </div>
                <dl className="ui-kv">
                  <div className="ui-kv__row">
                    <dt>{t("service.hours")}</dt>
                    <dd>{data.service.working_hours}</dd>
                  </div>
                  <div className="ui-kv__row">
                    <dt>{t("service.contact")}</dt>
                    <dd>{data.service.contact}</dd>
                  </div>
                </dl>
                <p className="text-small text-ink-tertiary">{t(data.service.available ? "service.available" : "service.outside")}</p>
                {orderId && (
                  <p className="break-all text-small text-ink-secondary">
                    {t("service.order")}：{orderId}
                  </p>
                )}
                <Button variant="ghost" onClick={() => setPanel("feedback")}>
                  {t("service.feedback")}
                </Button>
              </div>
            </Card>
            {/* feat:S35-04 报错有结论回复。feat:S35-08 工单进度与回复只读。 */}
            <Card title={t("tickets.title")}>
              <p className="mb-3 text-small text-ink-tertiary">{t("tickets.description")}</p>
              <ul className="flex flex-col divide-y divide-line-soft">
                {data.tickets.map((item) => (
                  <li key={item.id} className="flex flex-col gap-2 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag tone={item.status === "resolved" ? "success" : "warning"}>{t(`tickets.${item.status}`)}</Tag>
                      <span className="break-all text-small text-ink-tertiary">{item.id}</span>
                    </div>
                    <h3 className="font-medium">{item.title}</h3>
                    <p className="text-small text-ink-secondary">{item.reply}</p>
                    <Button size="sm" variant="ghost" onClick={() => setTicket(item)}>
                      {t("tickets.detail")}
                    </Button>
                  </li>
                ))}
              </ul>
              {data.tickets.length === 0 && <p className="text-ink-tertiary">{t("tickets.empty")}</p>}
            </Card>
            <Card title={t("help.title")}>
              <p className="mb-3 text-small text-ink-tertiary">{t("help.description")}</p>
              <div className="flex flex-col divide-y divide-line-soft">
                {data.faq.map((item) => (
                  <details key={item.id} className="py-3">
                    <summary className="cursor-pointer font-medium">{item.question}</summary>
                    <p className="mt-2 text-ink-secondary">{item.answer}</p>
                  </details>
                ))}
              </div>
            </Card>
          </div>
        }
      />

      <Dialog open={panel === "announcement"} onClose={close} title={data.announcement.title}>
        <p>{data.announcement.body}</p>
      </Dialog>
      <Dialog
        open={panel === "push"}
        onClose={close}
        title={t("push.title")}
        description={t("push.body")}
        actions={
          <>
            <Button variant="secondary" onClick={close}>
              {t("push.later")}
            </Button>
            <Button
              onClick={() => {
                close();
                soon("push");
              }}
            >
              {t("push.confirm")}
            </Button>
          </>
        }
      />
      <Dialog open={panel === "ai"} onClose={close} title={t("service.ai_title")} description={t("service.ai_note")}>
        <AiContent>
          <p>{data.service.ai_answer}</p>
        </AiContent>
        <Button className="mt-4" variant="secondary" onClick={() => setPanel("human")}>
          {t("service.human")}
        </Button>
      </Dialog>
      <Dialog
        open={panel === "feedback" || panel === "human"}
        onClose={close}
        title={t(panel === "human" ? "service.human" : "service.feedback")}
        description={t("service.feedback_desc")}
        actions={
          <>
            <Button variant="secondary" onClick={close}>
              {t("service.close")}
            </Button>
            <Button
              onClick={() => {
                if (!feedback.trim()) {
                  setValidation(true);
                  return;
                }
                soon(panel === "human" ? "human" : "feedback");
              }}
            >
              {t("service.submit")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {feedbackContext}
          {panel === "human" && (
            <p>
              {data.service.working_hours} · {data.service.contact}
              <br />
              {t(data.service.available ? "service.available" : "service.outside")}
            </p>
          )}
          <label className="flex flex-col gap-2">
            {t("service.message")}
            <textarea
              rows={4}
              className="w-full rounded-sm border border-line-strong bg-bg-surface p-3"
              value={feedback}
              onChange={(event) => {
                setFeedback(event.target.value);
                setValidation(false);
              }}
              aria-invalid={validation}
            />
          </label>
          {validation && (
            <p role="alert" className="text-status-danger">
              {t("feedback_validation")}
            </p>
          )}
        </div>
      </Dialog>
      <Dialog
        open={ticket !== null}
        onClose={() => setTicket(null)}
        title={ticket?.title ?? t("tickets.title")}
        description={t("tickets.readonly")}
      >
        {ticket && (
          <div className="flex flex-col gap-3">
            <Tag>{t(`tickets.${ticket.status}`)}</Tag>
            <p className="break-all text-small text-ink-tertiary">
              {ticket.id} · {formatDateTime(ticket.updated_at, data.time_zone)}
            </p>
            <h3 className="font-medium">{t("tickets.context")}</h3>
            <p>{ticket.context}</p>
            {ticket.order_id && (
              <p>
                {t("service.order")}：{ticket.order_id}
              </p>
            )}
            <h3 className="font-medium">{t("tickets.reply")}</h3>
            <p>{ticket.reply}</p>
            <h3 className="font-medium">{t("tickets.conclusion")}</h3>
            <p>{ticket.conclusion}</p>
            {/* feat:S35-12 仅处理完成的工单可以评价满意度，不包含 P2 意见调查。 */}
            {ticket.status === "resolved" && (
              <div className="flex flex-col gap-2">
                <h3 className="font-medium">{t("tickets.satisfaction")}</h3>
                <div className="flex gap-2">
                  <Button onClick={() => soon("satisfaction")}>{t("tickets.satisfied")}</Button>
                  <Button variant="secondary" onClick={() => soon("satisfaction")}>
                    {t("tickets.unsatisfied")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </ContainerScope>
  );
}
