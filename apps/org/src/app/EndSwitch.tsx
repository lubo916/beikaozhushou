// 机构端顶栏的“机构与校区”切换（O01-04 多校区切换与汇总）：机构数据还没接入，点了先提示“即将上线”。
import { useTranslation } from "react-i18next";
import { useToast } from "./toast.tsx";

export function EndSwitch() {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => toast(t("shell.switch.soon"))}
      className="inline-flex min-w-[0] shrink items-center gap-2 rounded-full border border-line-strong bg-bg-sunk py-1 pr-3 pl-1 text-small"
    >
      <span className="truncate rounded-full bg-brand-primary px-2 py-1 font-bold text-bg-surface">{t("shell.switch.label")}</span>
      <span className="hidden shrink-0 @tablet:inline">{t("shell.switch.hint")}</span>
    </button>
  );
}
