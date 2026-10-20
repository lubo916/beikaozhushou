// 机构端与平台后台的外壳（F05，ui-rules 第 2 节；简版，开工决定第 3 条）：桌面 236 侧栏、平板 72 图标栏、手机顶栏加分组抽屉。
// 断点取外壳容器的宽度（容器查询 @tablet、@desktop）；正文区自己滚动，导航与顶栏不动。
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PageState, UiLinkProvider, type LinkRenderer } from "@exam-prep/ui";
import { Link, useLocation } from "../router/history.tsx";
import type { PageMeta } from "../router/pages.ts";
import { NavDrawer } from "./NavDrawer.tsx";
import { usePageName } from "./parts.tsx";
import { SideNav } from "./SideNav.tsx";
import { Toast, ToastContext, useToastState } from "./toast.tsx";
import { TopBar } from "./TopBar.tsx";
import "./shell.css";

/** 公共组件里的链接走本端路由（跳转不整页刷新）。 */
const renderLink: LinkRenderer = ({ href, className, children, ...rest }) => (
  <Link to={href} className={className} {...rest}>
    {children}
  </Link>
);

export function StaffShell({ page, children }: { page: PageMeta | undefined; children: ReactNode }) {
  const { t } = useTranslation();
  const pageName = usePageName();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const toast = useToastState();
  useEffect(() => setNavOpen(false), [pathname]);
  const name = page === undefined ? t("notFound.title") : pageName(page.id);
  return (
    <ToastContext.Provider value={toast.show}>
      <UiLinkProvider value={renderLink}>
        <div className="@container h-dvh bg-bg-canvas font-sans text-body leading-body text-ink-primary">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-sm focus:bg-bg-surface focus:px-3 focus:py-2"
          >
            {t("shell.skip")}
          </a>
          <div className="flex h-full">
            <SideNav page={page} />
            <div className="flex min-w-[0] flex-1 flex-col">
              <TopBar page={page} name={name} onOpenNav={() => setNavOpen(true)} />
              <div className="relative min-h-[0] flex-1">
                <main id="main" tabIndex={-1} className="h-full overflow-y-auto px-4 py-4 @tablet:px-6 @tablet:py-6">
                  <Suspense fallback={<PageState state="loading" pageName={name} audience="staff" />}>{children}</Suspense>
                </main>
                <Toast message={toast.message} />
              </div>
            </div>
          </div>
          <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
        </div>
      </UiLinkProvider>
    </ToastContext.Provider>
  );
}
