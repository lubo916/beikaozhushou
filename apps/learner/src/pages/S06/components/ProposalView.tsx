// 一条待确认的提议（feat:S06-10；中断回归的重组方案 feat:S06-11、S06-18）：公共提议卡，固定四行改什么、为什么、代价、不改会怎样，
// 按钮只有“确认”和“不改”（红线 3）。四行文字与里面的数字由接口给（计划引擎按参数算好），标题按种类取文案；AI 提出的带 AI 标识（红线 4）。
// 确认、不改、撤销都是写操作，权限动作还没登记（contracts/permissions.yaml 里 plan 只有读），接后端前提示“即将上线”（F08-Q4）。
import { useTranslation } from "react-i18next";
import type { S06ProposalItem } from "@exam-prep/contract";
import { param } from "@exam-prep/params";
import { ProposalCard } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export interface ProposalViewProps {
  readonly item: S06ProposalItem;
  readonly className?: string | undefined;
}

export function ProposalView({ item, className }: ProposalViewProps) {
  const { t } = useTranslation("S06");
  const toast = useToast();
  const { proposal } = item;
  return (
    <ProposalCard
      className={className}
      title={t(`proposal.kind.${item.kind}`, { days: item.days ?? 0 })}
      what={proposal.change}
      why={proposal.reason}
      cost={proposal.cost}
      ifNot={proposal.if_declined}
      status={proposal.status}
      aiGenerated={item.ai_generated}
      onConfirm={() => toast(t("soon.confirm"))}
      onDecline={() => toast(t("soon.decline"))}
      onUndo={() => toast(t("soon.undo_proposal"))}
      undoHint={t("plan_adjust.undo_hint", { days: param("plan.proposal.undo_days") })}
    />
  );
}
