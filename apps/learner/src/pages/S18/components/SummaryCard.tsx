// 练习小结（S18-15）：对了多少、慢在哪、错因分布、下一步练什么；超时只在这里提示，不打断作答（S18-22）。数字都由接口给。
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S18QuizSession } from "@exam-prep/contract";
import { formatSeconds } from "@exam-prep/shared/format";
import { vocabLabel } from "@exam-prep/shared/vocab";
import { Card, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

export function SummaryCard({ session }: { session: S18QuizSession }) {
  const { t } = useTranslation("S18");
  const summary = session.summary;
  // feat:S18-15 练习小结
  return (
    <Card title={t("summary.title")}>
      {summary === undefined ? (
        <p className="text-small text-ink-secondary">{t("summary.placeholder")}</p>
      ) : (
        <div className="flex flex-col gap-3 text-small">
          <p className="text-body font-bold">{t("summary.score", { correct: summary.correct, total: summary.total })}</p>
          <section className="flex flex-col gap-1">
            <h3 className="font-bold">{t("summary.slow_title")}</h3>
            {summary.overtime.length === 0 ? (
              <p>{t("summary.slow_none")}</p>
            ) : (
              <ul className="list-disc pl-5">
                {summary.overtime.map((entry) => (
                  <li key={entry.index}>
                    {t("summary.slow_item", {
                      n: entry.index + 1,
                      used: formatSeconds(entry.seconds),
                      suggested: formatSeconds(entry.suggested_seconds),
                    })}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="flex flex-col gap-1">
            <h3 className="font-bold">{t("summary.causes_title")}</h3>
            {summary.error_causes.length === 0 && summary.uncategorized === 0 ? (
              <p>{t("summary.causes_none")}</p>
            ) : (
              <ul className="list-disc pl-5">
                {summary.error_causes.map((entry) => (
                  <li key={entry.cause}>{t("summary.cause_item", { cause: vocabLabel("error_cause", entry.cause), n: entry.count })}</li>
                ))}
                {summary.uncategorized > 0 && <li>{t("summary.causes_uncategorized", { n: summary.uncategorized })}</li>}
              </ul>
            )}
          </section>
          {summary.mistakes_added > 0 && <p>{t("summary.mistakes", { n: summary.mistakes_added })}</p>}
          {summary.pending > 0 && <p>{t("summary.pending", { n: summary.pending })}</p>}
          <section className="flex flex-col gap-1">
            <h3 className="font-bold">{t("summary.next_title")}</h3>
            {summary.next_steps.length === 0 ? (
              <p>{t("summary.next_none")}</p>
            ) : (
              <ul className="list-disc pl-5">
                {summary.next_steps.map((step) => (
                  <li key={step.point_id}>
                    <Link to={pathTo("S10", { kpId: step.point_id })} className="text-brand-primary underline">
                      {step.point_name}
                    </Link>
                    {t(`summary.next_reason.${step.reason}`)}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="flex flex-wrap gap-2">
            <Link to={pathTo("S17")} className={buttonClass("primary", "sm")}>
              {t("summary.again")}
            </Link>
            <Link to={pathTo("S19")} className={buttonClass("secondary", "sm")}>
              {t("summary.mistakes_link")}
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
