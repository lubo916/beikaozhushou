// feat:S10-09 加入今日：估算耗时、会挤掉今天哪一项都由接口给；确认这一步是写操作，接后端前提示“即将上线”。
import { useTranslation } from "react-i18next";
import type { S10AddToday } from "@exam-prep/contract";
import { formatDuration } from "@exam-prep/shared/format";
import { Button, Dialog } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export interface AddTodayDialogProps {
  readonly open: boolean;
  readonly estimate: S10AddToday;
  readonly onClose: () => void;
}

export function AddTodayDialog({ open, estimate, onClose }: AddTodayDialogProps) {
  const { t } = useTranslation("S10");
  const toast = useToast();
  let impact = t("add_today.fits");
  if (estimate.displaces !== undefined) impact = t("add_today.displaces", { task: estimate.displaces });
  if (estimate.in_today) impact = t("add_today.already");
  const confirm = (): void => {
    onClose();
    toast(t("soon.add_today"));
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("add_today.title")}
      description={t("add_today.estimate", { duration: formatDuration(estimate.minutes) })}
      actions={
        <>
          <Button onClick={onClose}>{t("add_today.cancel")}</Button>
          <Button variant="primary" disabled={estimate.in_today} onClick={confirm}>
            {t("add_today.confirm")}
          </Button>
        </>
      }
    >
      <p>{impact}</p>
    </Dialog>
  );
}
