// 标准页顶栏（ui-rules 第 2 节）：手机是分组抽屉按钮、页名、目标切换、通知；平板与桌面再加端名与分组、快速捕获、搜索、“问导师”。
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button, buttonClass, cx } from "@exam-prep/ui";
import { formatDays } from "@exam-prep/shared/format";
import type { MeContext } from "@exam-prep/contract";
import { pathTo } from "../routes.ts";
import type { PageMeta } from "../router/pages.ts";
import { ShellIcon, type ShellIconName } from "./icons.tsx";
import { useToast } from "./toast.tsx";

const ICON_BUTTON =
  "inline-flex size-10 items-center justify-center rounded-md border border-line-strong bg-bg-surface text-title text-ink-secondary hover:text-ink-primary";

export interface TopBarProps {
  readonly page: PageMeta | undefined;
  readonly name: string;
  readonly context: MeContext | undefined;
  readonly showTutor: boolean;
  readonly onOpenNav: () => void;
  readonly onOpenTutor: () => void;
}

export function TopBar({ page, name, context, showTutor, onOpenNav, onOpenTutor }: TopBarProps) {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-line-soft bg-bg-surface px-3 py-2 @tablet:gap-3 @tablet:px-6">
      <span className="@tablet:hidden">
        <button
          type="button"
          className={ICON_BUTTON}
          aria-label={t("shell.top.openNav")}
          title={t("shell.top.openNav")}
          onClick={onOpenNav}
        >
          <ShellIcon name="menu" />
        </button>
      </span>
      <div className="min-w-[0] flex-1">
        <p className="hidden truncate text-small text-ink-tertiary @tablet:block">
          {page === undefined ? t("app.end") : t("shell.top.crumb", { end: t("app.end"), group: t(`group.${page.group}`) })}
        </p>
        <p className="truncate font-bold">{name}</p>
      </div>
      <GoalSwitch context={context} />
      <Hidden>
        <button
          type="button"
          className={ICON_BUTTON}
          aria-label={t("shell.top.capture")}
          title={t("shell.top.capture")}
          onClick={() => toast(t("shell.top.captureSoon"))}
        >
          <ShellIcon name="plus" />
        </button>
      </Hidden>
      <Hidden>
        <IconLink to={pathTo("S29")} label={t("shell.top.search")} icon="search" />
      </Hidden>
      <IconLink to={pathTo("S35")} label={t("shell.top.notice")} icon="bell" />
      {showTutor && (
        <Hidden>
          <Button variant="primary" size="sm" onClick={onOpenTutor}>
            {t("shell.tutor.ask")}
          </Button>
        </Hidden>
      )}
    </header>
  );
}

/** 手机上收起的顶栏按钮。 */
function Hidden({ children }: { children: ReactNode }) {
  return <span className="hidden @tablet:inline-flex">{children}</span>;
}

function IconLink({ to, label, icon }: { to: string; label: string; icon: ShellIconName }) {
  return (
    <Link to={to} className={ICON_BUTTON} aria-label={label} title={label}>
      <ShellIcon name={icon} />
    </Link>
  );
}

/** 目标切换：考试简称＋距目标日天数（接口 /me/context 给的值）；点开去备考目标页切换或管理。还没有目标时给“先定目标”。 */
function GoalSwitch({ context }: { context: MeContext | undefined }) {
  const { t } = useTranslation();
  if (context === undefined) return null;
  const goal = context.goal;
  if (goal === undefined) {
    return (
      <Link to={pathTo("S02")} className={buttonClass("secondary", "sm")}>
        {t("shell.goal.none")}
      </Link>
    );
  }
  const days = goal.days_to_target >= 0 ? formatDays(goal.days_to_target) : t("shell.goal.passed");
  return (
    <Link
      to={pathTo("S02")}
      title={t("shell.goal.manage")}
      aria-label={t("shell.goal.aria", { exam: goal.exam_name, days })}
      className={cx(
        "inline-flex min-w-[0] shrink items-center gap-2 rounded-full border border-line-strong bg-bg-sunk py-1 pr-3 pl-1 text-small",
      )}
    >
      <span className="truncate rounded-full bg-brand-primary px-2 py-1 font-bold text-bg-surface">{goal.short_name}</span>
      <span className="shrink-0 font-bold tabular-nums">{days}</span>
    </Link>
  );
}
