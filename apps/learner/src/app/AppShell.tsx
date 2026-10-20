// 学员端外壳（F05，ui-rules 第 2、3 节）：按当前页面与视图的模式换外观——
// 标准页有侧栏（桌面）、图标栏（平板）或底部标签加分组抽屉（手机），顶栏与“问导师”；引导页、沉浸页、独立页各有自己的顶栏。
// 断点取外壳容器的宽度（容器查询 @tablet、@desktop）；正文区自己滚动，导航与顶栏不动。
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation } from "react-router";
import { PageState, UiLinkProvider, type LinkRenderer } from "@exam-prep/ui";
import { useGetMeContext } from "@exam-prep/contract";
import { TUTOR_ID } from "../routes.ts";
import { findPage, resolveView, type PageMode } from "../router/pages.ts";
import { DevViewBar } from "./DevViewBar.tsx";
import { GuidedBar, ImmersiveBar, StandaloneBar } from "./ModeBars.tsx";
import { NavDrawer } from "./NavDrawer.tsx";
import { ShellPageContext, ShellSlotContext, type ShellPage } from "./page-context.tsx";
import { SideNav } from "./SideNav.tsx";
import { TabBar } from "./TabBar.tsx";
import { Toast, ToastContext, useToastState } from "./toast.tsx";
import { TopBar } from "./TopBar.tsx";
import { TutorFab, TutorPanel } from "./Tutor.tsx";
import { useNarrow } from "./useNarrow.ts";
import "./shell.css";

/** 公共组件里的链接走路由（跳转不整页刷新）。 */
const renderLink: LinkRenderer = ({ href, className, children, ...rest }) => (
  <Link to={href} className={className} {...rest}>
    {children}
  </Link>
);

interface ChosenView {
  readonly id: string;
  readonly key: string | null;
}

export function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const context = useGetMeContext().data;
  const page = findPage(location.pathname);
  const pageId = page?.id;

  const [chosen, setChosen] = useState<ChosenView | null>(null);
  const forced = import.meta.env.DEV ? new URLSearchParams(location.search).get("view") : null;
  const view = page === undefined ? undefined : resolveView(page, forced, chosen?.id === page.id ? chosen.key : null);
  const mode: PageMode = view?.mode ?? page?.mode ?? "standard";
  const setView = useCallback(
    (key: string | null) => {
      if (pageId !== undefined) setChosen({ id: pageId, key });
    },
    [pageId],
  );
  const shellPage = useMemo<ShellPage>(() => ({ page, view, mode, setView }), [page, view, mode, setView]);

  const [navOpen, setNavOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const narrow = useNarrow(rootRef);
  const toast = useToastState();

  useEffect(() => {
    setNavOpen(false);
    setTutorOpen(false);
  }, [location.pathname]);

  const name = page === undefined ? t("notFound.title") : t(`page.${page.id}`);
  const onboarding = context !== undefined && context.goal === undefined;
  const tutorAllowed = (mode === "standard" || mode === "immersive") && pageId !== TUTOR_ID && view?.noTutor !== true;
  const standard = mode === "standard";

  return (
    <ShellPageContext.Provider value={shellPage}>
      <ShellSlotContext.Provider value={slot}>
        <ToastContext.Provider value={toast.show}>
          <UiLinkProvider value={renderLink}>
            <div ref={rootRef} data-mode={mode} className="@container h-dvh bg-bg-canvas font-sans text-body leading-body text-ink-primary">
              <a
                href="#main"
                className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-sm focus:bg-bg-surface focus:px-3 focus:py-2"
              >
                {t("shell.skip")}
              </a>
              <div className="flex h-full">
                {standard && <SideNav page={page} onboarding={onboarding} user={context?.user} />}
                <div className="flex min-w-[0] flex-1 flex-col">
                  {standard && (
                    <TopBar
                      page={page}
                      name={name}
                      context={context}
                      showTutor={tutorAllowed}
                      onOpenNav={() => setNavOpen(true)}
                      onOpenTutor={() => setTutorOpen(true)}
                    />
                  )}
                  {mode === "guided" && page !== undefined && <GuidedBar page={page} />}
                  {mode === "immersive" && <ImmersiveBar name={name} onSlot={setSlot} />}
                  {mode === "standalone" && <StandaloneBar />}
                  <div className="relative min-h-[0] flex-1">
                    <main id="main" tabIndex={-1} className="h-full overflow-y-auto px-4 py-4 @tablet:px-6 @tablet:py-6">
                      <DevViewBar page={page} view={view} />
                      <Suspense fallback={<PageState state="loading" pageName={name} />}>
                        <Outlet />
                      </Suspense>
                    </main>
                    {tutorAllowed && <TutorFab onOpen={() => setTutorOpen(true)} />}
                    <Toast message={toast.message} />
                  </div>
                  {standard && <TabBar page={page} />}
                </div>
              </div>
              {standard && <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} onboarding={onboarding} />}
              {tutorAllowed && <TutorPanel open={tutorOpen} onClose={() => setTutorOpen(false)} narrow={narrow} pageName={name} />}
            </div>
          </UiLinkProvider>
        </ToastContext.Provider>
      </ShellSlotContext.Provider>
    </ShellPageContext.Provider>
  );
}
