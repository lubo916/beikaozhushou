import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S31Membership } from "@exam-prep/contract";
import { formatCount, formatDate, formatDateTime } from "@exam-prep/shared/format";
import { Banner, Button, Card, Dialog, KeyValueList, Tag, buttonClass } from "@exam-prep/ui";
import { useState } from "react";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

export function CurrentCard({ data, offline }: { data: S31Membership; offline: boolean }) {
  const { t } = useTranslation("S31");
  const toast = useToast();
  const [closing, setClosing] = useState(false);
  const current = data.current;
  const day = (value: string) => formatDate(value, { year: true });
  const at = (value: string) => formatDateTime(value, data.time_zone, { year: true });
  return (
    <>
      {/* feat:S31-04 feat:S31-09 自动续费只用于时长订阅，关闭确认后当期仍有效。 */}
      <Card
        title={t("current.title")}
        meta={<Tag tone="brand">{t(`plans.${current.plan_id}`)}</Tag>}
        actions={
          <Link to={pathTo("S35")} className={buttonClass("ghost", "sm")}>
            {t("current.support")}
          </Link>
        }
      >
        <KeyValueList
          items={[
            { key: "kind", label: t("current.kind"), value: t(`kind.${current.kind}`) },
            {
              key: "valid",
              label: t("current.valid"),
              value: current.plan_id == "free" ? t("current.lifetime") : day(current.valid_until),
            },
            {
              key: "final",
              label: t("current.final"),
              value: current.plan_id == "free" ? t("current.lifetime") : day(current.final_expiry),
            },
            { key: "renewal", label: t("current.renewal"), value: current.auto_renew ? t("current.renewing") : t("current.manual") },
          ]}
        />
        {current.auto_renew && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-small text-ink-secondary">
              {t("current.next", { date: at(current.next_charge_at), amount: current.next_charge_text })}
            </p>
            <Button size="sm" disabled={offline} onClick={() => setClosing(true)}>
              {t("current.close_renewal")}
            </Button>
          </div>
        )}
        {/* feat:S31-18 扣款失败宽限期保留权益，展示接口给的重试时间。 */}
        {current.grace.active && (
          <Banner
            tone="warning"
            title={t("current.grace", { date: day(current.grace.until), retry: at(current.grace.next_retry_at) })}
            action={
              <Button size="sm" disabled={offline} onClick={() => toast(t("soon"))}>
                {t("current.payment_method")}
              </Button>
            }
          />
        )}
        {/* feat:S31-12 设备管理指向数据与隐私。 */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
          <span className="text-small text-ink-secondary">
            {t("current.devices", { used: formatCount(current.devices_used), limit: formatCount(current.device_limit) })}
          </span>
          <Link to={pathTo("S32")} className={buttonClass("secondary", "sm")}>
            {t("current.manage_devices")}
          </Link>
        </div>
        {/* feat:S31-20 顺延清单及最终到期日由接口决定，页面不累计时长。 */}
        <h3 className="mt-4 font-medium">{t("current.pending")}</h3>
        {current.pending.length === 0 ? (
          <p className="text-small text-ink-tertiary">{t("current.pending_empty")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {current.pending.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2 text-small">
                <Tag size="sm">{t(`source.${item.source}`)}</Tag>
                <span>{t("current.pending_period", { start: day(item.starts_on), end: day(item.ends_on) })}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-small text-ink-tertiary">{t("current.pending_note")}</p>
        {/* feat:S31-07 到期降级不阻断、数据可见可导出。 */}
        <p className="mt-3 rounded-sm bg-bg-sunk p-3 text-small text-ink-secondary">{t("current.retained")}</p>
      </Card>
      <Dialog
        open={closing}
        onClose={() => setClosing(false)}
        title={t("current.close_title")}
        description={t("current.close_body", { date: day(current.valid_until) })}
        actions={
          <>
            <Button onClick={() => setClosing(false)}>{t("cancel")}</Button>
            <Button
              variant="primary"
              onClick={() => {
                setClosing(false);
                toast(t("soon"));
              }}
            >
              {t("current.close_confirm")}
            </Button>
          </>
        }
      />
    </>
  );
}
