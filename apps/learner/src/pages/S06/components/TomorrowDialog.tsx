// feat:S06-16 全部完成态：“明天第一件事”预览（接口给）与可选加练；加练要出题，接后端前提示“即将上线”。
import { useTranslation } from "react-i18next";
import type { S06TaskPreview } from "@exam-prep/contract";
import { formatDuration } from "@exam-prep/shared/format";
import { VOCAB } from "@exam-prep/shared/vocab";
import { Button, Dialog } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export interface TomorrowDialogProps {
  readonly open: boolean;
  readonly preview: S06TaskPreview;
  readonly onClose: () => void;
}

export function TomorrowDialog({ open, preview, onClose }: TomorrowDialogProps) {
  const { t } = useTranslation("S06");
  const toast = useToast();
  const extra = (): void => {
    onClose();
    toast(t("soon.extra"));
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("tomorrow.title")}
      actions={
        <>
          <Button onClick={extra}>{t("tomorrow.extra")}</Button>
          <Button variant="primary" onClick={onClose}>
            {t("tomorrow.close")}
          </Button>
        </>
      }
    >
      <p>
        {t("tomorrow.body", {
          source: VOCAB.task_source[preview.source],
          title: preview.title,
          duration: formatDuration(preview.minutes),
        })}
      </p>
    </Dialog>
  );
}
