import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S31Membership } from "@exam-prep/contract";
import { formatDateTime } from "@exam-prep/shared/format";
import { Button, Card, DataTable, Dialog, KeyValueList, PageState, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

function supportPath(order: string): string {
  return pathTo("S35") + "?" + new URLSearchParams({ order }).toString();
}

export function OrdersCard({ data, offline }: { data: S31Membership; offline: boolean }) {
  const { t } = useTranslation("S31");
  const toast = useToast();
  const [all, setAll] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const refund = data.refund;
  return (
    <>
      {/* feat:S31-08 订单记录；feat:S31-15 发票申请与下载。 */}
      <Card
        title={t("orders.title")}
        actions={
          <Button size="sm" variant="ghost" onClick={() => setAll(true)}>
            {t("orders.all")}
          </Button>
        }
      >
        {data.view_state === "insufficient_data" && (
          <PageState
            compact
            state="insufficient_data"
            pageName={t("title")}
            title={t("state.insufficient_data.title")}
            body={t("state.insufficient_data.body")}
          />
        )}
        <ul className="flex flex-col gap-4">
          {data.orders.map((order) => (
            <li key={order.id} className="min-w-0 border-b border-line-soft pb-4 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-medium">{order.product}</h3>
                <Tag size="sm" tone={order.status === "paid" ? "success" : "neutral"}>
                  {t(`order_status.${order.status}`)}
                </Tag>
              </div>
              <p className="mt-1 break-all text-small text-ink-tertiary">{t("orders.number", { number: order.order_number })}</p>
              <p className="mt-1 text-small text-ink-secondary">
                {formatDateTime(order.purchased_at, data.time_zone)} · {order.amount_text} · {t(`channel.${order.channel}`)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {order.invoice_status !== "unavailable" && (
                  <Button size="sm" disabled={offline} onClick={() => toast(t("soon"))}>
                    {t(order.invoice_status === "issued" ? "orders.download" : "orders.invoice")}
                  </Button>
                )}
                <Link className={buttonClass("ghost", "sm")} to={supportPath(order.order_number)}>
                  {t("orders.support")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
        {/* feat:S31-16 退款先展示公式、接口试算和进度，再允许申请。 */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line-soft pt-3">
          <Button size="sm" disabled={offline || data.orders.length === 0} onClick={() => setRefundOpen(true)}>
            {t("orders.refund")}
          </Button>
          <Button size="sm" variant="ghost" disabled={offline || data.orders.length === 0} onClick={() => setRefundOpen(true)}>
            {t("orders.refund_progress")}
          </Button>
        </div>
      </Card>
      <Dialog
        open={all}
        onClose={() => setAll(false)}
        title={t("orders.all")}
        actions={<Button onClick={() => setAll(false)}>{t("close")}</Button>}
      >
        <DataTable
          caption={t("orders.all")}
          rows={data.orders}
          rowKey={(row) => row.id}
          stackOnNarrow
          empty={t("orders.empty")}
          columns={[
            {
              key: "product",
              header: t("orders.detail"),
              label: t("orders.detail"),
              render: (row) => (
                <>
                  <p>{row.product}</p>
                  <p className="break-all text-small text-ink-tertiary">{row.order_number}</p>
                </>
              ),
            },
            { key: "amount", header: t("orders.amount"), label: t("orders.amount"), render: (row) => row.amount_text },
            { key: "status", header: t("orders.status"), label: t("orders.status"), render: (row) => t(`order_status.${row.status}`) },
          ]}
        />
      </Dialog>
      <Dialog
        open={refundOpen}
        onClose={() => {
          setRefundOpen(false);
          setConfirming(false);
        }}
        title={t("refund.title")}
        actions={
          <>
            <Button
              onClick={() => {
                setRefundOpen(false);
                setConfirming(false);
              }}
            >
              {t("close")}
            </Button>
            <Button
              variant="primary"
              disabled={offline || refund.status !== "available"}
              onClick={() => {
                if (!confirming) setConfirming(true);
                else {
                  setConfirming(false);
                  setRefundOpen(false);
                  toast(t("soon"));
                }
              }}
            >
              {t(confirming ? "refund.confirm" : "refund.apply")}
            </Button>
          </>
        }
      >
        {confirming && (
          <p role="status" className="mb-3 rounded-sm bg-status-warning-soft p-3 text-small">
            {t("refund.confirm_note", { amount: refund.estimated_text })}
          </p>
        )}
        <p className="break-all text-small text-ink-secondary">{t("orders.number", { number: refund.order_number })}</p>
        <h3 className="mt-3 font-medium">{t("refund.formula")}</h3>
        <p className="mt-1 text-small">{refund.formula_text}</p>
        <KeyValueList
          items={[
            { key: "paid", label: t("refund.paid"), value: refund.paid_text },
            { key: "consumed", label: t("refund.consumed"), value: refund.consumed_text },
            { key: "fee", label: t("refund.fee"), value: refund.fee_text },
            {
              key: "estimated",
              label: t("refund.estimated"),
              value: <strong className="text-brand-primary">{refund.estimated_text}</strong>,
            },
          ]}
        />
        <p className="mt-3 text-small text-ink-tertiary">{t("refund.note")}</p>
        <h3 className="mt-4 font-medium">{t("refund.status")}</h3>
        <p className="mt-1 text-small">{refund.status_text}</p>
        <ol className="mt-3 flex flex-col gap-2">
          {refund.progress.map((item) => (
            <li key={item.step} className="flex flex-wrap justify-between gap-2 text-small">
              <span>{t(`refund.${item.step}`)}</span>
              <Tag size="sm" tone={item.completed ? "success" : "neutral"}>
                {t(item.completed ? "refund.done" : "refund.waiting")}
              </Tag>
            </li>
          ))}
        </ol>
        <Link className={buttonClass("ghost", "sm")} to={supportPath(refund.order_number)}>
          {t("orders.support")}
        </Link>
      </Dialog>
    </>
  );
}

export function PaymentCard({ data, offline }: { data: S31Membership; offline: boolean }) {
  const { t } = useTranslation("S31");
  const toast = useToast();
  const [reason, setReason] = useState(data.payment_failures[0]?.reason);
  const failure = data.payment_failures.find((item) => item.reason === reason);
  return (
    <Card title={t("payment.title")}>
      {/* feat:S31-17 按失败原因说明出路；已扣款未开通直达人工客服，不让用户重复支付。 */}
      <label className="flex flex-col gap-2 text-small">
        {t("payment.reason")}
        <select
          className="min-w-0 rounded-sm border border-line-strong bg-bg-surface p-2"
          value={reason}
          onChange={(event) => setReason(event.target.value as typeof reason)}
        >
          {data.payment_failures.map((item) => (
            <option key={item.reason} value={item.reason}>
              {t(`payment.${item.reason}`)}
            </option>
          ))}
        </select>
      </label>
      {failure !== undefined && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-small text-ink-secondary">{t(`payment.${failure.reason}`)}</p>
          <p className="break-all text-small text-ink-tertiary">{t("orders.number", { number: failure.order_number })}</p>
          {failure.retry_allowed && (
            <Button disabled={offline} size="sm" onClick={() => toast(t("soon"))}>
              {t("payment.retry")}
            </Button>
          )}
          {failure.contact_required && (
            <Link to={supportPath(failure.order_number)} className={buttonClass("primary", "sm")}>
              {t("payment.support")}
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}
