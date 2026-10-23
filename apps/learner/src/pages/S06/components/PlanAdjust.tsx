// 计划调整（feat:S06-10 调整告知与待确认提议）：只挪时间的自动做——计划引擎夜间自动顺延，次日在这里告知，参数 plan.proposal.undo_days 天内可撤销；
// 改目标、范围、轮次的先问你——以待确认的提议出现（红线 3：只有计划引擎能自动顺延，AI 只能提议）。哪天挪的、挪了什么、那天学了多久都由接口给。
// 撤销是写操作，权限动作还没登记，接后端前提示“即将上线”（F08-Q4）。手机上英雄区下面的置顶一行点了跳到这张卡片（锚点 ADJUST_ANCHOR）。
import { useTranslation } from "react-i18next";
import type { S06Adjustments, S06Carryover } from "@exam-prep/contract";
import { param } from "@exam-prep/params";
import { formatDate, formatDuration, formatRelativeDay } from "@exam-prep/shared/format";
import { Card, UndoBar } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { ProposalView } from "./ProposalView.tsx";

/** 计划调整卡片的锚点：手机上置顶的那一行点了跳到这里。 */
export const ADJUST_ANCHOR = "s06-plan-adjust";

function CarryoverBar({ item, today }: { item: S06Carryover; today: string }) {
  const { t } = useTranslation("S06");
  const toast = useToast();
  return (
    <UndoBar
      message={
        <>
          <strong className="block">{t("plan_adjust.carryover_title", { when: formatRelativeDay(item.moved_on, today) })}</strong>
          {t("plan_adjust.carryover_body", {
            title: item.title,
            from: formatDate(item.from_day, { weekday: true }),
            to: formatRelativeDay(item.to_day, today),
          })}
          {item.spent_minutes !== undefined && t("plan_adjust.carryover_spent", { spent: formatDuration(item.spent_minutes) })}
          {t("plan_adjust.carryover_rule")}
        </>
      }
      hint={t("plan_adjust.undo_hint", { days: param("plan.proposal.undo_days") })}
      onUndo={() => toast(t("soon.undo"))}
    />
  );
}

export interface PlanAdjustProps {
  readonly adjustments: S06Adjustments;
  /** 今天（接口给的学习日），用来把顺延的日子写成“昨天”“今天”。 */
  readonly today: string;
}

export function PlanAdjust({ adjustments, today }: PlanAdjustProps) {
  const { t } = useTranslation("S06");
  if (adjustments.carryovers.length === 0 && adjustments.proposals.length === 0) return null;
  return (
    <Card id={ADJUST_ANCHOR} tabIndex={-1} title={t("plan_adjust.title")} meta={t("plan_adjust.meta")}>
      <div className="flex flex-col gap-3">
        {adjustments.carryovers.map((item) => (
          <CarryoverBar key={item.id} item={item} today={today} />
        ))}
        {adjustments.proposals.map((item) => (
          <ProposalView key={item.proposal.id} item={item} />
        ))}
      </div>
    </Card>
  );
}
