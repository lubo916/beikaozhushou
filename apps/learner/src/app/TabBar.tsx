// 手机底部五个标签（容器 < 700）：今日、学习、练测、导师、我的；当前页所在分组对应的标签高亮。
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { cx } from "@exam-prep/ui";
import { pathTo } from "../routes.ts";
import { TABS, type PageMeta } from "../router/pages.ts";
import { Badge } from "./parts.tsx";

export function TabBar({ page }: { page: PageMeta | undefined }) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("shell.tabs.label")}
      className="shrink-0 border-t border-line-soft bg-bg-surface pb-[env(safe-area-inset-bottom)] @tablet:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = page !== undefined && tab.groups.includes(page.group);
          return (
            <li key={tab.key}>
              <Link
                to={pathTo(tab.page)}
                aria-current={page?.id === tab.page ? "page" : undefined}
                className={cx(
                  "flex flex-col items-center gap-1 py-2 text-small",
                  active ? "font-bold text-brand-primary-ink" : "text-ink-secondary",
                )}
              >
                <Badge text={t(`tabBadge.${tab.key}`)} active={active} />
                {t(`tab.${tab.key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
