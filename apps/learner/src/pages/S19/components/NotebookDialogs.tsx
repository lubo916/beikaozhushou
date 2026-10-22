import { useTranslation } from "react-i18next";
import type { S19Notebook } from "@exam-prep/contract";
import { formatNumber } from "@exam-prep/shared/format";
import { Button, Dialog } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export type NotebookDialog = "photo" | "export" | "analysis" | null;
export function NotebookDialogs({ dialog, data, onClose }: { dialog: NotebookDialog; data: S19Notebook | undefined; onClose: () => void }) {
  const { t } = useTranslation("S19");
  const toast = useToast();
  const confirm = () => {
    onClose();
    toast(t(dialog === "analysis" ? "soon_analysis" : "soon"));
  };
  const action = dialog === "photo" ? "actions.import" : dialog === "export" ? "actions.print" : "actions.confirm";
  const cost = data?.insights.analysis_cost;
  return (
    <Dialog
      open={dialog !== null}
      onClose={onClose}
      title={t(dialog === "photo" ? "photo.title" : dialog === "export" ? "export.title" : "insights.confirm_title")}
      actions={
        <>
          <Button onClick={onClose}>{t("actions.cancel")}</Button>
          <Button variant="primary" disabled={dialog === "analysis" && (cost === undefined || data?.insights.restricted)} onClick={confirm}>
            {t(action)}
          </Button>
        </>
      }
    >
      {dialog === "photo" && (
        <div className="flex flex-col gap-3">
          <p>{t("photo.body")}</p>
          <label className="s19-field">
            <span>{t("photo.file")}</span>
            <input type="file" accept="image/*" />
          </label>
        </div>
      )}
      {dialog === "export" && (
        <div className="flex flex-col gap-3">
          <label className="s19-field">
            <span>{t("export.group")}</span>
            <select>
              <option>{t("export.point")}</option>
              <option>{t("export.cause")}</option>
            </select>
          </label>
          <label>
            <input type="checkbox" defaultChecked /> {t("export.hide")}
          </label>
          <label>
            <input type="checkbox" defaultChecked /> {t("export.blank")}
          </label>
          <p>{t("export.ai")}</p>
        </div>
      )}
      {dialog === "analysis" && <p>{t("insights.confirm_body", { cost: cost === undefined ? "—" : formatNumber(cost, 0) })}</p>}
    </Dialog>
  );
}
