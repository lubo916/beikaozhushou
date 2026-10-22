import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { S31Membership } from "@exam-prep/contract";
import { formatDate, formatDateTime, formatCount } from "@exam-prep/shared/format";
import { Button, Card, Dialog, KeyValueList, PageState, Tag } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export function PurchaseCard({ data, offline }: { data: S31Membership; offline: boolean }) {
  const { t } = useTranslation("S31");
  const toast = useToast();
  const [choice, setChoice] = useState<"single" | "auto" | null>(null);
  const [detail, setDetail] = useState<"transfer" | "upgrade" | null>(null);
  const [buying, setBuying] = useState<"pass" | "subscription" | null>(null);
  const purchase = data.purchase;
  const until = (day: string) => formatDate(day, { year: true });
  const next = formatDateTime(purchase.subscription.next_charge_at, data.time_zone, { year: true });
  return (
    <>
      {/* feat:S31-03 两种买法与互转；不发起真实支付。 */}
      <Card title={t("purchase.title")}>
        <div className="grid min-w-0 gap-3 @tablet:grid-cols-2">
          <section className="flex min-w-0 flex-col gap-3 rounded-md border border-line-strong p-4">
            <h3 className="font-medium">{t("purchase.pass")}</h3>
            <p className="font-serif text-title text-brand-primary">{purchase.pass.price_text}</p>
            <p className="text-small text-ink-secondary">{t("purchase.pass_body")}</p>
            <p className="text-small">
              {t("purchase.pass_until", { target: until(purchase.pass.target_day), until: until(purchase.pass.valid_until) })}
            </p>
            <Button variant="primary" disabled={offline} onClick={() => setBuying("pass")}>
              {t("purchase.pass_buy")}
            </Button>
          </section>
          <section className="flex min-w-0 flex-col gap-3 rounded-md border border-line-strong p-4">
            <h3 className="font-medium">{t("purchase.subscription")}</h3>
            <p className="font-serif text-title text-brand-primary">
              {t("purchase.period", { months: formatCount(purchase.subscription.period_months), amount: purchase.subscription.price_text })}
            </p>
            <p className="text-small text-ink-secondary">{t("purchase.subscription_body")}</p>
            {/* feat:S31-09 两项并列且不预选，必须由用户主动选择。 */}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-small text-ink-tertiary">{t("purchase.choose")}</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="membership-purchase"
                  value="single"
                  checked={choice === "single"}
                  disabled={offline}
                  onChange={() => setChoice("single")}
                />
                {t("purchase.single")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="membership-purchase"
                  value="auto"
                  checked={choice === "auto"}
                  disabled={offline}
                  onChange={() => setChoice("auto")}
                />
                {t("purchase.auto")}
              </label>
            </fieldset>
            <p className="text-small text-ink-secondary">
              {choice === "auto"
                ? t("purchase.auto_note", { date: next, amount: purchase.subscription.price_text })
                : t("purchase.single_note")}
            </p>
            <Button variant="primary" disabled={offline || choice === null} onClick={() => setBuying("subscription")}>
              {t("purchase.submit")}
            </Button>
          </section>
        </div>
        {offline && <p className="mt-3 text-small text-ink-tertiary">{t("purchase.disabled")}</p>}
        <Button className="mt-3" size="sm" disabled={offline} onClick={() => setDetail("transfer")}>
          {t("purchase.transfer")}
        </Button>
        {/* feat:S31-25 按端展示支付方式，原渠道续费退款，苹果不支持优惠码。 */}
        <h3 className="mt-4 font-medium">{t("purchase.channel")}</h3>
        <ul className="mt-2 flex flex-col gap-2 text-small">
          {data.channels.map((channel) => (
            <li key={channel.key} className="flex flex-wrap gap-2">
              <Tag size="sm">{t(`channel.${channel.key}`)}</Tag>
              <span>{channel.methods.map((method) => t(`method.${method}`)).join("、")}</span>
              {!channel.supports_discount_code && <span className="text-ink-tertiary">{t("purchase.ios_note")}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-small text-ink-secondary">{t("purchase.channel_note")}</p>
      </Card>
      {/* feat:S31-21 升级按接口给出的剩余价值补差，可查算法。 */}
      <Card title={t("upgrade.title")}>
        <p>{t("upgrade.body", { credit: data.upgrade.credit_text, due: data.upgrade.due_text })}</p>
        <p className="mt-2 text-small text-ink-secondary">{t("upgrade.until", { date: until(data.upgrade.valid_until) })}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setDetail("upgrade")}>
            {t("upgrade.rules")}
          </Button>
          <Button size="sm" disabled={offline || data.view_state === "restricted"} onClick={() => toast(t("soon"))}>
            {t("upgrade.action")}
          </Button>
        </div>
        {data.view_state === "restricted" && (
          <PageState
            state="restricted"
            compact
            pageName={t("title")}
            title={t("state.restricted.title")}
            body={t("state.restricted.body")}
          />
        )}
      </Card>
      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={t(detail === "upgrade" ? "upgrade.rules" : "purchase.transfer")}
        actions={<Button onClick={() => setDetail(null)}>{t("close")}</Button>}
      >
        {detail === "upgrade" ? (
          <>
            <p>{data.upgrade.calculation_text}</p>
            <KeyValueList
              items={[
                { key: "from", label: t("current.kind"), value: t(`plans.${data.upgrade.from_plan}`) },
                { key: "to", label: t("upgrade.action"), value: t(`plans.${data.upgrade.to_plan}`) },
                { key: "until", label: t("current.valid"), value: until(data.upgrade.valid_until) },
              ]}
            />
          </>
        ) : (
          <p>{t("purchase.transfer_body", { amount: purchase.transfer_credit_text })}</p>
        )}
      </Dialog>
      <Dialog
        open={buying !== null}
        onClose={() => setBuying(null)}
        title={t("purchase.confirm_title")}
        description={t("purchase.confirm_note")}
        actions={
          <>
            <Button onClick={() => setBuying(null)}>{t("cancel")}</Button>
            <Button
              variant="primary"
              disabled={offline}
              onClick={() => {
                setBuying(null);
                toast(t("soon"));
              }}
            >
              {t("purchase.confirm")}
            </Button>
          </>
        }
      >
        <KeyValueList
          items={[
            { key: "kind", label: t("current.kind"), value: t(buying === "pass" ? "purchase.pass" : "purchase.subscription") },
            {
              key: "amount",
              label: t("orders.amount"),
              value:
                buying === "pass"
                  ? purchase.pass.price_text
                  : t("purchase.period", {
                      months: formatCount(purchase.subscription.period_months),
                      amount: purchase.subscription.price_text,
                    }),
            },
            {
              key: "renewal",
              label: t("current.renewal"),
              value:
                buying === "subscription" && choice === "auto"
                  ? t("purchase.auto_note", { date: next, amount: purchase.subscription.price_text })
                  : t("purchase.single_note"),
            },
          ]}
        />
        <p className="mt-3 text-small text-ink-secondary">
          {buying === "pass"
            ? t("purchase.pass_until", { target: until(purchase.pass.target_day), until: until(purchase.pass.valid_until) })
            : t("purchase.channel_note")}
        </p>
      </Dialog>
    </>
  );
}
