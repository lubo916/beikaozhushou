import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { P01Alert, P01Cockpit } from "@exam-prep/contract";
import { formatDateTime, formatPercent } from "@exam-prep/shared";
import { AiContent, Button, Card, List, Tag, buttonClass, type TagTone } from "@exam-prep/ui";
import { Link } from "../../../router/history.tsx";
import { pathTo } from "../../../routes.ts";

const SEVERITY_TONE: Readonly<Record<P01Alert["severity"], TagTone>> = { high: "danger", medium: "warning", low: "neutral" };

function alertTitle(t: TFunction<"P01">, alert: P01Alert): string {
  const subject = t(`alerts.subjects.${alert.subject}`);
  switch (alert.kind) {
    case "latency_high":
      return t("alerts.kinds.latency_high", { subject, seconds: alert.threshold_seconds ?? 0 });
    case "error_spike":
      return t("alerts.kinds.error_spike", { subject });
    case "budget_exceeded":
      return t("alerts.kinds.budget_exceeded", { subject, change: formatPercent(Math.abs(alert.change_ratio ?? 0)) });
    case "metric_drop":
      return t("alerts.kinds.metric_drop", { subject, change: formatPercent(Math.abs(alert.change_ratio ?? 0)) });
  }
}

// feat:P01-04 异常告警：指标、服务、成本三类；“处理”还没有后端，点了提示“即将上线”。
// AI 做什么：异常归因摘要，一律带 AI 标识。
export function AlertsCard({ data, onHandle }: { data: P01Cockpit; onHandle: () => void }) {
  const { t } = useTranslation("P01");
  return (
    <Card title={t("alerts.title")} meta={t("alerts.meta", { n: data.open_alert_count })}>
      {data.alerts.length === 0 ? (
        <p className="text-small text-ink-tertiary">{t("alerts.none")}</p>
      ) : (
        <List>
          {data.alerts.map((alert) => (
            <li key={alert.id} className="flex flex-col gap-2 p-3">
              <div className="flex flex-wrap gap-1">
                <Tag size="sm" tone={SEVERITY_TONE[alert.severity]}>
                  {t(`alerts.severity.${alert.severity}`)}
                </Tag>
                <Tag size="sm" tone="outline">
                  {t(`alerts.categories.${alert.category}`)}
                </Tag>
                {alert.status === "acknowledged" && (
                  <Tag size="sm" tone="success">
                    {t("alerts.acknowledged")}
                  </Tag>
                )}
              </div>
              <strong>{alertTitle(t, alert)}</strong>
              <span className="text-small text-ink-tertiary">
                {t("alerts.when", { time: formatDateTime(alert.raised_at, data.time_zone) })}
              </span>
              {alert.ai_summary !== undefined && <AiContent note={t("alerts.aiNote")}>{alert.ai_summary}</AiContent>}
              <div className="flex flex-wrap gap-1">
                <Button size="sm" onClick={onHandle}>
                  {t("alerts.handle")}
                </Button>
                {alert.related_page !== undefined && (
                  <Link to={pathTo(alert.related_page)} className={buttonClass("secondary", "sm")}>
                    {t(`alerts.pages.${alert.related_page}`)}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </List>
      )}
    </Card>
  );
}
