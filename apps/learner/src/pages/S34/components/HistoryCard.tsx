import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S34History } from "@exam-prep/contract";
import { formatDate, formatDuration, formatScore } from "@exam-prep/shared/format";
import { Card, List, ListRow, Tag, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

// feat:S34-01 历次目标、成绩、投入用时与报告入口。
export function HistoryCard({ items }: { items: readonly S34History[] }) {
  const { t } = useTranslation("S34");
  return (
    <Card title={t("history.title")}>
      {items.length === 0 ? (
        <p className="text-small text-ink-tertiary">{t("history.none")}</p>
      ) : (
        <List>
          {items.map((item) => (
            <ListRow
              key={item.id}
              title={item.name}
              description={
                <span className="flex flex-col gap-1">
                  <span>{t("history.completed", { date: formatDate(item.completed_on, { year: true }) })}</span>
                  {item.scores.map((score) => (
                    <span key={score.name}>
                      {t("history.score", { name: score.name, score: formatScore(score.value, { total: score.total }) })}
                    </span>
                  ))}
                  <span>{t("history.duration", { duration: formatDuration(item.minutes) })}</span>
                </span>
              }
              trailing={
                <Tag size="sm" tone={item.status === "passed" ? "success" : "neutral"}>
                  {t(`history.status.${item.status}`)}
                </Tag>
              }
              action={
                <Link className={buttonClass("secondary", "sm")} to={pathTo("S08")}>
                  {t("history.report")}
                </Link>
              }
            />
          ))}
        </List>
      )}
    </Card>
  );
}
