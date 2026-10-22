// “为什么这样排”（feat:S06-04 排序规则；feat:S06-02 时间预算与配比）：三段的先后、巩固段保底占比、推进段的配比模式；配比模式去学习计划里改。
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S06Budget } from "@exam-prep/contract";
import { formatPercent } from "@exam-prep/shared/format";
import { TODAY_SEGMENT, VOCAB } from "@exam-prep/shared/vocab";
import { Button, Dialog, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

export interface OrderDialogProps {
  readonly open: boolean;
  readonly budget: S06Budget;
  readonly onClose: () => void;
}

export function OrderDialog({ open, budget, onClose }: OrderDialogProps) {
  const { t } = useTranslation("S06");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("order.title")}
      actions={
        <Button variant="primary" onClick={onClose}>
          {t("order.close")}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <p>{t("order.segments", { ...TODAY_SEGMENT })}</p>
        <p>{t("order.floor", { consolidate: TODAY_SEGMENT.consolidate, ratio: formatPercent(budget.floor_ratio) })}</p>
        <p>{t("order.budget", { advance: TODAY_SEGMENT.advance, mode: VOCAB.mix_mode[budget.mix_mode] })}</p>
        <p>
          <Link to={pathTo("S07")} className={buttonClass("secondary", "sm")}>
            {t("order.plan")}
          </Link>
        </p>
      </div>
    </Dialog>
  );
}
