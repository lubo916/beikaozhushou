// 开发用的“切视图”条（只在开发模式出现；自动化测试里不出现，免得影响截图）：列出本页的视图，点一下改地址里的 ?view=。
// 切演示考试、强制页面状态与时间旅行在 F04 的“开发工具”里（左下角），两处合并留给整合任务。
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { cx } from "@exam-prep/ui";
import type { PageMeta, PageView } from "../router/pages.ts";

const SHOW_DEV_TOOLS = import.meta.env.DEV && !(typeof navigator !== "undefined" && navigator.webdriver);

export interface DevViewBarProps {
  readonly page: PageMeta | undefined;
  readonly view: PageView | undefined;
  readonly visible?: boolean | undefined;
}

export function DevViewBar({ page, view, visible = SHOW_DEV_TOOLS }: DevViewBarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  if (!visible || page === undefined) return null;
  const linkTo = (key: string): string => {
    const query = new URLSearchParams(location.search);
    query.set("view", key);
    return `${location.pathname}?${query.toString()}`;
  };
  return (
    <aside
      aria-label={t("dev.label")}
      className="mb-4 flex flex-wrap items-center gap-2 rounded-sm border border-dashed border-status-warning-line bg-status-warning-soft px-3 py-2 text-small text-status-warning"
    >
      <span className="font-bold">{t("dev.title", { id: page.id })}</span>
      {page.views.length === 0 ? (
        <span>{t("dev.noViews")}</span>
      ) : (
        <>
          <span>{t("dev.views")}</span>
          {page.views.map((item) => (
            <Link
              key={item.key}
              to={linkTo(item.key)}
              aria-current={item.key === view?.key ? "true" : undefined}
              className={cx(
                "rounded-sm border px-2 py-1",
                item.key === view?.key ? "border-status-warning bg-bg-surface font-bold" : "border-status-warning-line",
              )}
            >
              {t("dev.view", { key: item.key, name: t(`view.${page.id}.${item.key}`) })}
            </Link>
          ))}
        </>
      )}
      <span>{t("dev.more")}</span>
    </aside>
  );
}
