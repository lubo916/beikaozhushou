// 导师浮标与面板的外壳（内容留给 U28）：右下角常驻“问导师”，点开在桌面与平板是右侧抽屉、手机是底部面板。
// 引导页、独立页、导师页本身，以及摸底测评中与模考作答中不显示（由外壳判断）。
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Sheet, buttonClass } from "@exam-prep/ui";
import { TUTOR_ID, pathTo } from "../routes.ts";

export function TutorFab({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="absolute right-4 bottom-4 z-10 inline-flex items-center gap-2 rounded-full bg-brand-primary-ink px-4 py-3 font-bold text-bg-surface hover:bg-brand-primary"
    >
      <span aria-hidden="true" className="size-3 rounded-full bg-status-ai-soft" />
      {t("shell.tutor.ask")}
    </button>
  );
}

export interface TutorPanelProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** 手机布局：从底部出来。 */
  readonly narrow: boolean;
  readonly pageName: string;
}

export function TutorPanel({ open, onClose, narrow, pageName }: TutorPanelProps) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} side={narrow ? "bottom" : "right"} title={t("shell.tutor.title")}>
      {open && (
        <div className="flex flex-col gap-3">
          <p>{t("shell.tutor.intro")}</p>
          <p className="text-small text-ink-tertiary">{t("shell.tutor.context", { page: pageName })}</p>
          <Link to={pathTo(TUTOR_ID)} onClick={onClose} className={buttonClass("ai")}>
            {t("shell.tutor.openPage")}
          </Link>
        </div>
      )}
    </Sheet>
  );
}
