import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Dialog } from "@exam-prep/ui";
const OPTIONS = ["annotations", "notes", "relations", "records"] as const;
// feat:S32-08 通用格式完整导出。 feat:S32-13 分别选择内容及个人数据提醒。 feat:S32-14 任何档位不限次数。
export function ExportDialog({ open, close, confirm }: { open: boolean; close: () => void; confirm: () => void }) {
  const { t } = useTranslation("S32");
  const [selected, setSelected] = useState<readonly string[]>(OPTIONS);
  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("export.title")}
      description={t("export.description")}
      actions={
        <>
          <Button onClick={close}>{t("common.cancel")}</Button>
          <Button variant="primary" disabled={selected.length === 0} onClick={confirm}>
            {t("export.confirm")}
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">{t("export.title")}</legend>
        {OPTIONS.map((option) => (
          <label key={option} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={(event) =>
                setSelected((previous) => (event.target.checked ? [...previous, option] : previous.filter((key) => key !== option)))
              }
            />
            {t("export.options." + option)}
          </label>
        ))}
      </fieldset>
      <p className="mt-4 text-small text-ink-secondary">{t("export.personal")}</p>
      <p className="mt-3 text-small text-ink-secondary">{t("export.format")}</p>
      {selected.length === 0 && (
        <p role="status" className="mt-3">
          {t("export.empty")}
        </p>
      )}
    </Dialog>
  );
}
