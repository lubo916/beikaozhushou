// 顶栏（ui-rules 第 2 节）：手机是分组抽屉按钮与页名；平板与桌面加上端名与分组。右侧是切换（机构端为机构与校区、平台后台为环境）、通知、退出登录。
// 通知与退出登录要等账号与消息接入，现在点了先提示“即将上线”。
import { useTranslation } from "react-i18next";
import type { PageMeta } from "../router/pages.ts";
import { EndSwitch } from "./EndSwitch.tsx";
import { ShellIcon, type ShellIconName } from "./icons.tsx";
import { useToast } from "./toast.tsx";

const ICON_BUTTON =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-line-strong bg-bg-surface text-title text-ink-secondary hover:text-ink-primary";

export interface TopBarProps {
  readonly page: PageMeta | undefined;
  readonly name: string;
  readonly onOpenNav: () => void;
}

export function TopBar({ page, name, onOpenNav }: TopBarProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const iconButton = (label: string, icon: ShellIconName, onClick: () => void) => (
    <button type="button" className={ICON_BUTTON} aria-label={label} title={label} onClick={onClick}>
      <ShellIcon name={icon} />
    </button>
  );
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-line-soft bg-bg-surface px-3 py-2 @tablet:gap-3 @tablet:px-6">
      <span className="@tablet:hidden">{iconButton(t("shell.top.openNav"), "menu", onOpenNav)}</span>
      <div className="min-w-[0] flex-1">
        <p className="hidden truncate text-small text-ink-tertiary @tablet:block">
          {page === undefined ? t("app.end") : t("shell.top.crumb", { end: t("app.end"), group: t(`group.${page.group}`) })}
        </p>
        <p className="truncate font-bold">{name}</p>
      </div>
      <EndSwitch />
      {iconButton(t("shell.top.notice"), "bell", () => toast(t("shell.top.noticeSoon")))}
      {iconButton(t("shell.top.logout"), "logout", () => toast(t("shell.top.logoutSoon")))}
    </header>
  );
}
