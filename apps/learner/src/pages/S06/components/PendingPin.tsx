// 手机上置顶的一行（bk spec 布局：手机是 英雄区 → 待确认提议（若有，置顶一行）→ 清单 → 三个数折叠成一行摘要）：
// 有待确认的提议时，在英雄区下面说有几条、第一条是什么，点了跳到计划调整卡片；平板与桌面不显示（容器查询）。
// 只要有待确认的提议就出现，不分视图（U06b-Q1 先按 A：按 bk spec 的“若有”由数据决定；原型截图只在正常视图画了这一行）。
import { useTranslation } from "react-i18next";
import type { S06Adjustments } from "@exam-prep/contract";
import { ADJUST_ANCHOR } from "./PlanAdjust.tsx";

export function PendingPin({ adjustments }: { adjustments: S06Adjustments | undefined }) {
  const { t } = useTranslation("S06");
  const pending = (adjustments?.proposals ?? []).filter((item) => item.proposal.status === "pending");
  const first = pending[0];
  if (first === undefined) return null;
  const title = t(`proposal.kind.${first.kind}`, { days: first.days ?? 0 });
  const label = t(pending.length > 1 ? "plan_adjust.pin_more" : "plan_adjust.pin", { n: pending.length, title });
  const jump = (): void => {
    const target = document.getElementById(ADJUST_ANCHOR);
    target?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
  };
  return (
    <button
      type="button"
      onClick={jump}
      className="w-full rounded-md border border-status-warning-line bg-status-warning-soft px-4 py-3 text-center text-small text-status-warning @tablet:hidden"
    >
      {label}
    </button>
  );
}
