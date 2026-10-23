import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S34Goal } from "@exam-prep/contract";
import { formatDate, formatPercent } from "@exam-prep/shared/format";
import { Button, Card, List, ListRow, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

// feat:S34-02 新增目标重走入门；暂停、恢复、归档暂提示即将上线，保留原记录。
export function GoalsCard({ goals }: { goals: readonly S34Goal[] }) {
  const { t } = useTranslation("S34");
  const toast = useToast();
  return (
    <Card
      title={t("goals.title")}
      meta={t("goals.hint")}
      actions={
        <Link to={pathTo("S02")} className={buttonClass("primary", "sm")}>
          {t("goals.add")}
        </Link>
      }
    >
      <List>
        {goals.map((goal) => (
          <ListRow
            key={goal.id}
            title={goal.name}
            description={
              <span className="flex flex-col gap-1">
                <span>{t("goals.target", { date: formatDate(goal.target_date, { year: true }) })}</span>
                <span>{t("goals.completion", { value: formatPercent(goal.completion) })}</span>
              </span>
            }
            trailing={
              <Tag tone={goal.status === "active" ? "brand" : "neutral"} size="sm">
                {t(`goals.status.${goal.status}`)}
              </Tag>
            }
            action={
              goal.status !== "archived" ? (
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" onClick={() => toast(t(goal.status === "active" ? "soon.pause" : "soon.resume"))}>
                    {t(goal.status === "active" ? "goals.pause" : "goals.resume")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toast(t("soon.archive"))}>
                    {t("goals.archive")}
                  </Button>
                </div>
              ) : undefined
            }
          />
        ))}
      </List>
    </Card>
  );
}
