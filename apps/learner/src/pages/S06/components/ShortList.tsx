// 不可学日与中断回归时的清单：只有一小段任务，不分三段、不给换档。
// feat:S06-17 今天不可学态：只保留到期复习的最小版，其余自动顺延，不出现“落后”；请假与忙季在学习计划里设置。
// feat:S06-11 断连恢复、feat:S06-18 中断回归态：先给一个很短的启动任务，不展示累计未完成量（重组方案的提议在 U06b）。
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S06TodayHome } from "@exam-prep/contract";
import { Card, List, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";
import { TaskItem } from "./TaskItem.tsx";

export function ShortList({ data }: { data: S06TodayHome }) {
  const { t } = useTranslation("S06");
  const off = data.view === "off";
  const items = data.segments.flatMap((group) => group.items);
  const footer = off ? (
    <p className="flex flex-wrap items-center gap-2 text-small text-ink-secondary">
      <span>{t("list.off_note")}</span>
      <Link to={pathTo("S07")} className={buttonClass("ghost", "sm")}>
        {t("list.off_plan")}
      </Link>
    </p>
  ) : undefined;
  return (
    <Card
      title={off ? t("list.title") : t("list.back_title")}
      meta={off ? t("list.off_meta") : t("list.back_meta", { days: data.away_days ?? 0 })}
      footer={footer}
    >
      <List>
        {items.map((item) => (
          <TaskItem key={item.task.id} item={item} />
        ))}
      </List>
    </Card>
  );
}
