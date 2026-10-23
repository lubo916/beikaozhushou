// 节点提醒（feat:S06-23 节点提醒条，P1）：与我相关的报名、公告等节点，按条件出现——接口只给离今天不超过 window_days 天的，没有就不显示。
// 天数是接口给的数（节点提醒天数的参数待规则卡提出、整合任务登记，errata 第 11 条）。“考试日历”去 S25（路由表）。
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S06Milestones } from "@exam-prep/contract";
import { formatDate } from "@exam-prep/shared/format";
import { Card, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

export function Milestones({ milestones }: { milestones: S06Milestones }) {
  const { t } = useTranslation("S06");
  if (milestones.items.length === 0) return null;
  return (
    <Card
      title={t("milestones.title")}
      actions={
        <Link to={pathTo("S25")} className={buttonClass("ghost", "sm")}>
          {t("milestones.calendar")}
        </Link>
      }
    >
      <ul className="flex flex-col gap-2">
        {milestones.items.map((item) => {
          const variant = item.status === "estimated" ? "estimated" : "official";
          return (
            <li key={`${item.kind}-${item.date}`} className="rounded-sm border-l-4 border-status-warning bg-status-warning-soft px-3 py-2">
              <p className="font-bold">{t(`milestones.kind.${item.kind}.${variant}`, { date: formatDate(item.date) })}</p>
              <p className="text-small text-ink-secondary">
                {t("milestones.note", { days: milestones.window_days, detail: t(`milestones.kind.${item.kind}.detail`) })}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
