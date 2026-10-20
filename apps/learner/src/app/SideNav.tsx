// 桌面侧栏与平板图标栏（ui-rules 第 2 节）：同一个导航，容器 ≥ 1024 是 236 宽的分组侧栏，700–1023 是 72 宽的图标栏
// （点分组字标弹出这一组的页面），手机上隐藏（改用底部标签与分组抽屉）。
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { cx } from "@exam-prep/ui";
import type { MeContext } from "@exam-prep/contract";
import type { NavGroup, PageMeta } from "../router/pages.ts";
import { Badge, GroupLinks, visibleGroups } from "./parts.tsx";

export interface SideNavProps {
  readonly page: PageMeta | undefined;
  readonly onboarding: boolean;
  readonly user: MeContext["user"] | undefined;
}

export function SideNav({ page, onboarding, user }: SideNavProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<NavGroup | null>(null);
  const ref = useRef<HTMLElement | null>(null);
  const baseId = useId();
  const { pathname } = useLocation();

  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    if (open === null) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && ref.current?.contains(event.target) !== true) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <nav
      ref={ref}
      aria-label={t("shell.nav.label")}
      className="relative z-20 hidden h-full w-(--shell-rail-width) shrink-0 flex-col border-r border-line-soft bg-bg-surface @tablet:flex @desktop:w-(--shell-sidebar-width)"
    >
      <div className="flex items-baseline justify-center gap-2 px-2 py-4 @desktop:justify-start @desktop:px-5">
        <span className="text-center font-serif text-title leading-[1.2] font-bold text-brand-primary-ink">{t("app.product")}</span>
        <span className="hidden text-small text-ink-tertiary @desktop:inline">{t("app.end")}</span>
      </div>
      <div className="flex min-h-[0] flex-1 flex-col gap-1 px-2 pb-4 @desktop:overflow-y-auto @desktop:px-3">
        {visibleGroups(onboarding).map((group) => {
          const labelId = `${baseId}-${group}`;
          const active = page?.group === group;
          const isOpen = open === group;
          return (
            <div key={group} className="relative">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : group)}
                className={cx(
                  "hidden w-full flex-col items-center gap-1 rounded-md py-2 text-small @tablet:flex @desktop:hidden",
                  active ? "bg-brand-primary-soft font-bold text-brand-primary-ink" : "text-ink-secondary hover:bg-bg-sunk",
                )}
              >
                <Badge text={t(`groupBadge.${group}`)} active={active} />
                {t(`group.${group}`)}
              </button>
              <p id={labelId} className="hidden items-center gap-2 px-2 pt-3 pb-1 text-small font-bold text-ink-secondary @desktop:flex">
                <Badge text={t(`groupBadge.${group}`)} active={active} />
                {t(`group.${group}`)}
              </p>
              <div className="hidden @desktop:block">
                <GroupLinks group={group} labelledBy={labelId} />
              </div>
              {isOpen && (
                <div className="absolute top-[0] left-full z-30 ml-2 hidden w-max rounded-md border border-line-strong bg-bg-surface p-2 @tablet:block @desktop:hidden">
                  <p className="px-3 pb-1 text-small font-bold text-ink-secondary">{t(`group.${group}`)}</p>
                  <GroupLinks group={group} labelledBy={labelId} onNavigate={() => setOpen(null)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {user !== undefined && <UserCard user={user} />}
    </nav>
  );
}

function UserCard({ user }: { user: MeContext["user"] }) {
  const { t } = useTranslation();
  const initial = Array.from(user.display_name)[0] ?? "";
  return (
    <div className="flex items-center justify-center gap-3 border-t border-line-soft px-2 py-3 @desktop:justify-start @desktop:px-4">
      <span
        aria-hidden="true"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-primary font-bold text-bg-surface"
      >
        {initial}
      </span>
      <span className="sr-only @desktop:hidden">{user.display_name}</span>
      <span className="hidden min-w-[0] flex-col @desktop:flex">
        <span className="truncate font-bold">{user.display_name}</span>
        <span className="truncate text-small text-ink-tertiary">{user.is_guest ? t("shell.user.guest") : t("shell.user.member")}</span>
      </span>
    </div>
  );
}
