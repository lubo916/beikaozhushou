import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { S31Membership, S31Usage } from "@exam-prep/contract";
import { formatCount, formatDate, formatDateTime } from "@exam-prep/shared/format";
import { Button, Card, DataTable, Dialog, ProgressBar, Tag } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export function UsageCard({ data, offline }: { data: S31Membership; offline: boolean }) {
  const { t } = useTranslation("S31");
  const toast = useToast();
  const [selected, setSelected] = useState<S31Usage | null>(null);
  return (
    <>
      {/* feat:S31-05 feat:S31-06 用量、剩余、比例与明细均由接口给出。 */}
      <Card title={t("usage.title")}>
        <p className="mb-4 text-small text-ink-secondary">{t("usage.notice")}</p>
        <ul className="flex flex-col gap-4">
          {data.usage.map((item) => (
            <li key={item.key}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{t(`usage.${item.key}`)}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(item)}
                  aria-label={t("usage.detail_title", { name: t(`usage.${item.key}`) })}
                >
                  {t("usage.details")}
                </Button>
              </div>
              <ProgressBar label={t(`usage.${item.key}`)} value={item.percent} showLabel={false} />
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-small text-ink-secondary">
                <span>{t("usage.used", { used: formatCount(item.used, item.unit), limit: formatCount(item.limit, item.unit) })}</span>
                <span>{t("usage.remaining", { remaining: formatCount(item.remaining, item.unit) })}</span>
              </div>
            </li>
          ))}
        </ul>
        {/* feat:S31-10 一次性加量包，未用可退；实际购买待后端接通。 */}
        <section className="mt-4 border-t border-line-soft pt-4">
          <h3 className="font-medium">{t("addons.title")}</h3>
          <p className="mt-1 text-small text-ink-secondary">{t("addons.body")}</p>
          <ul className="mt-3 flex flex-col gap-3">
            {data.add_ons.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p>{t("addons.item", { name: t(`usage.${item.key}`), amount: formatCount(item.amount, item.unit) })}</p>
                  <p className="text-small text-ink-secondary">
                    {item.price_text}{" "}
                    {item.unused_refundable && (
                      <Tag size="sm" tone="success">
                        {t("addons.refundable")}
                      </Tag>
                    )}
                  </p>
                </div>
                <Button size="sm" disabled={offline} onClick={() => toast(t("soon"))}>
                  {t("addons.buy")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </Card>
      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={t("usage.detail_title", { name: selected === null ? "" : t(`usage.${selected.key}`) })}
        actions={<Button onClick={() => setSelected(null)}>{t("close")}</Button>}
      >
        {selected !== null && (
          <DataTable
            caption={t("usage.details")}
            stackOnNarrow
            rows={selected.details}
            rowKey={(row) => row.at + row.label}
            empty={t("usage.none")}
            columns={[
              { key: "at", header: t("usage.at"), label: t("usage.at"), render: (row) => formatDateTime(row.at, data.time_zone) },
              { key: "label", header: t("usage.activity"), label: t("usage.activity"), render: (row) => row.label },
              { key: "amount", header: t("usage.amount"), label: t("usage.amount"), render: (row) => formatCount(row.amount, row.unit) },
            ]}
          />
        )}
      </Dialog>
    </>
  );
}

export function ComparisonCard({ data }: { data: S31Membership }) {
  const { t } = useTranslation("S31");
  return (
    <Card id="membership-comparison" title={t("compare.title")}>
      {/* feat:S31-01 三档比较；人工档未就绪时受限；feat:S31-02 核心闭环全部不限量。 */}
      <DataTable
        caption={t("compare.title")}
        rows={data.comparison}
        rowKey={(row) => row.key}
        columns={[
          { key: "feature", header: t("compare.feature"), render: (row) => t(`compare.${row.key}`) },
          { key: "free", header: t("plans.free"), render: (row) => row.free },
          { key: "member", header: t("plans.member"), render: (row) => <span className="text-brand-primary">{row.member}</span> },
          { key: "human", header: t("plans.human"), render: (row) => row.human },
        ]}
      />
      <p className="mt-3 text-small text-ink-secondary">{t("compare.note")}</p>
    </Card>
  );
}

export function RedemptionCard({ data, offline }: { data: S31Membership; offline: boolean }) {
  const { t } = useTranslation("S31");
  const toast = useToast();
  const [code, setCode] = useState("");
  return (
    <Card title={t("redemption.title")}>
      {/* feat:S31-11 兑换与机构服务期，兑换不触发真实写操作。 */}
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          toast(t(code.trim() ? "soon" : "redemption.empty"));
        }}
      >
        <label className="flex flex-col gap-2 text-small">
          {t("redemption.label")}
          <input
            className="min-w-[0] rounded-sm border border-line-strong bg-bg-surface p-2 text-body"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={t("redemption.placeholder")}
            disabled={offline}
          />
        </label>
        <Button type="submit" disabled={offline}>
          {t("redemption.action")}
        </Button>
      </form>
      <p className="mt-2 text-small text-ink-tertiary">{t("redemption.hint")}</p>
      <p className="mt-4 font-medium">
        {t("redemption.institution", {
          name: data.redemption.institution_name,
          date: formatDate(data.redemption.service_until, { year: true }),
        })}
      </p>
      <p className="mt-1 text-small text-ink-secondary">{t("redemption.institution_note")}</p>
    </Card>
  );
}

export function ReminderCard({ data }: { data: S31Membership }) {
  const { t } = useTranslation("S31");
  return (
    <Card title={t("reminders.title")}>
      {/* feat:S31-19 自动续费改称“将自动续期”，最后一档说明到期后保留的权益。 */}
      <ul className="flex flex-col gap-3">
        {data.reminders.map((item) => (
          <li key={item.kind + item.at} className="border-b border-line-soft pb-3 last:border-b-0 last:pb-[0]">
            <p className="text-small font-medium">{t(`reminders.${item.kind}`, { days: formatCount(item.days_before) })}</p>
            <p className="mt-1 text-small text-ink-tertiary">
              {t("reminders.at", { date: formatDateTime(item.at, data.time_zone, { year: true }) })}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
