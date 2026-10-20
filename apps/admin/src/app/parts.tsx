// 外壳的小部件：分组字标、页名、一组页面链接（桌面侧栏、平板弹出层、手机抽屉共用）。
import { useTranslation } from "react-i18next";
import { cx } from "@exam-prep/ui";
import { pathTo, type PageId } from "../routes.ts";
import { Link, useLocation } from "../router/history.tsx";
import { NAME_VALUES, findPage, pagesInGroup, type NavGroup } from "../router/pages.ts";

export function Badge({ text, active = false }: { text: string; active?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-small font-bold",
        active ? "border-brand-primary bg-brand-primary text-bg-surface" : "border-line-strong bg-bg-surface text-ink-secondary",
      )}
    >
      {text}
    </span>
  );
}

/** 页名（有的页名带数，经占位符传入）。 */
export function usePageName(): (id: PageId) => string {
  const { t } = useTranslation();
  return (id) => t(`page.${id}`, { ...NAME_VALUES[id] });
}

export interface GroupLinksProps {
  readonly group: NavGroup;
  readonly labelledBy?: string | undefined;
  readonly onNavigate?: (() => void) | undefined;
}

export function GroupLinks({ group, labelledBy, onNavigate }: GroupLinksProps) {
  const pageName = usePageName();
  const current = findPage(useLocation().pathname)?.id;
  return (
    <ul aria-labelledby={labelledBy} className="flex flex-col gap-1">
      {pagesInGroup(group).map((page) => {
        const active = page.id === current;
        return (
          <li key={page.id}>
            <Link
              to={pathTo(page.id)}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cx(
                "block rounded-sm px-3 py-1",
                active
                  ? "bg-brand-primary-soft font-bold text-brand-primary-ink"
                  : "text-ink-secondary hover:bg-bg-sunk hover:text-ink-primary",
              )}
            >
              {pageName(page.id)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
