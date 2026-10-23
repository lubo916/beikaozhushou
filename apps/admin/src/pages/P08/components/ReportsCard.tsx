import { useTranslation } from "react-i18next";
import type { P08ErrorReport, P08QuestionReview, P08Resolution } from "@exam-prep/contract";
import { formatCount, formatDateTime } from "@exam-prep/shared";
import { AiContent, Button, Card, List, Tag, type TagTone } from "@exam-prep/ui";

type ReportStatus = "open" | "overdue" | "resolved";
const STATUS_TONE: Readonly<Record<ReportStatus, TagTone>> = { open: "warning", overdue: "danger", resolved: "success" };

/** 是否超时由接口判定（overdue），页面不比时间。 */
function reportStatus(report: P08ErrorReport): ReportStatus {
  if (report.status === "resolved") return "resolved";
  return report.overdue ? "overdue" : "open";
}

/** 闭环动作：结论、重新计分人数、修正掌握、通知报错人（都由接口给，页面只拼成一句）。 */
function Resolution({ resolution }: { resolution: P08Resolution }) {
  const { t } = useTranslation("P08");
  const steps: string[] = [t(`reports.conclusions.${resolution.conclusion}`)];
  if (resolution.rescored_users > 0) steps.push(t("reports.rescored", { n: formatCount(resolution.rescored_users) }));
  if (resolution.mastery_corrected) steps.push(t("reports.masteryCorrected"));
  if (resolution.reporters_notified) steps.push(t("reports.notified"));
  return <p className="text-small text-ink-secondary">{steps.join(t("reports.separator"))}</p>;
}

// feat:P08-04 用户报错处理：每条有回复时限（是否超时由接口判定），处理完给报错人结论回复。
// feat:P08-05 下架与修订：修订或下架后通知做过的用户并重新计分（人数由接口给）；按钮还没有后端，点了提示即将上线（F08-Q4）。
export function ReportsCard({ data, onSoon }: { data: P08QuestionReview; onSoon: () => void }) {
  const { t } = useTranslation("P08");
  return (
    <Card title={t("reports.title")} footer={<p className="text-small text-ink-tertiary">{t("reports.footer")}</p>}>
      {data.reports.length === 0 ? (
        <p className="text-small text-ink-tertiary">{t("reports.none")}</p>
      ) : (
        <List>
          {data.reports.map((report) => {
            const status = reportStatus(report);
            return (
              <li key={report.id} className="flex flex-col gap-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{t("reports.heading", { ref: report.question_ref, reason: t(`reports.reasons.${report.reason}`) })}</strong>
                  <Tag size="sm" tone={STATUS_TONE[status]}>
                    {t(`reports.status.${status}`)}
                  </Tag>
                </div>
                <span className="text-small text-ink-tertiary">
                  {t("reports.meta", { n: formatCount(report.reporter_count), due: formatDateTime(report.due_at, data.time_zone) })}
                </span>
                {report.resolution !== undefined && <Resolution resolution={report.resolution} />}
                {report.ai_summary !== undefined && <AiContent note={t("reports.aiNote")}>{report.ai_summary}</AiContent>}
                {report.status === "open" && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" size="sm" onClick={onSoon}>
                      {t("reports.reply")}
                    </Button>
                    <Button size="sm" onClick={onSoon}>
                      {t("reports.revise")}
                    </Button>
                    <Button variant="danger" size="sm" onClick={onSoon}>
                      {t("reports.withdraw")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </List>
      )}
    </Card>
  );
}
