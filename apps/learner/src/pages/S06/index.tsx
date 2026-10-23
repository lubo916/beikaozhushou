// S06 今日（U06a 上半：页面骨架、英雄区、三段清单与任务条；U06b 接着补右栏的三个数、计划调整、节点提醒与各视图的专属部件）。
// 写法照 S10 样板页（ui-rules 第 13 节）：页面只管显示；数据与“该显示哪一态”在 data.ts；七态由接口层制造，页面不为 ?state= 写分支。
// 视图（ui-rules 第 5 节）：开发与测试时把地址里的 ?view= 传给接口；接口回的 view 交给外壳（setView），正式环境由数据决定视图。
// 原型：python3 tools/bk.py spec S06、python3 tools/bk.py proto S06 --views。布局：页面内容区 ≥ 860 时左右两栏，窄了上下排；
// 左栏是英雄区与今日清单，右栏先空着、留给 U06b（U06a-Q3＝A）。
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { Banner, Button, COPY, Columns, ContainerScope, PageState, buttonClass } from "@exam-prep/ui";
import { useShellPage } from "../../app/page-context.tsx";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { Hero } from "./components/Hero.tsx";
import { ShortList } from "./components/ShortList.tsx";
import { TodayList } from "./components/TodayList.tsx";
import { TodaySkeleton } from "./components/TodaySkeleton.tsx";
import { forcedView, useTodayHome } from "./data.ts";

/** 页面内容区：容器查询的作用域（里面的组件按这块区域的宽度切换布局）。 */
function Frame({ children }: { children: ReactNode }) {
  return <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">{children}</ContainerScope>;
}

export default function Page() {
  const { t } = useTranslation("S06");
  const { t: tc } = useTranslation();
  const toast = useToast();
  const { setView } = useShellPage();
  const [search] = useSearchParams();
  const today = useTodayHome(import.meta.env.DEV ? forcedView(search.get("view")) : undefined);
  const pageName = tc("page.S06");
  const data = today.data;
  const view = data?.view;

  // 接口回的视图交给外壳（真实使用时由数据决定视图；开发与测试时地址里的 ?view= 优先）
  useEffect(() => {
    if (view !== undefined) setView(view);
  }, [view, setView]);

  if (today.state === "loading") {
    return (
      <Frame>
        <PageState
          state="loading"
          pageName={pageName}
          skeleton={<TodaySkeleton />}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        />
      </Frame>
    );
  }
  if (today.state === "offline") {
    return (
      <Frame>
        <PageState state="offline" pageName={pageName} body={t("state.offline.body")} />
      </Frame>
    );
  }
  if (today.state === "restricted") {
    return (
      <Frame>
        <PageState
          state="restricted"
          pageName={pageName}
          title={t("state.restricted.title")}
          body={t("state.restricted.body")}
          action={
            <Link to={pathTo("S31")} className={buttonClass("secondary")}>
              {t("state.restricted.action")}
            </Link>
          }
        />
      </Frame>
    );
  }
  if (today.state === "error" || data === undefined) {
    return (
      <Frame>
        <PageState state="error" pageName={pageName} onRetry={today.retry} onReport={() => toast(t("soon.report"))} />
      </Frame>
    );
  }
  const short = data.view === "off" || data.view === "back";
  // 右栏（U06b）：三个数、计划调整（自动顺延与撤销、待确认提议）、节点提醒；骨架先留好位置
  const aside = <div className="flex flex-col gap-4" />;
  return (
    <Frame>
      <h1 className="sr-only">{pageName}</h1>
      {today.stale && (
        <Banner
          tone="warning"
          title={t("state.offline.stale")}
          action={
            <Button size="sm" onClick={today.retry}>
              {COPY.action.retry}
            </Button>
          }
        >
          {t("state.offline.body")}
        </Banner>
      )}
      {/* 受限（额度用完）：只暂停高成本 AI，清单照常（bk spec 七态；F08-Q1） */}
      {data.ai_paused === "quota" && (
        <PageState
          state="restricted"
          compact
          title={t("state.restricted.title")}
          body={t("state.restricted.body")}
          action={
            <Link to={pathTo("S31")} className={buttonClass("secondary", "sm")}>
              {t("state.restricted.action")}
            </Link>
          }
        />
      )}
      {today.state === "empty" ? (
        <>
          <Hero data={data} bare />
          <PageState
            state="empty"
            title={t("state.empty.title")}
            body={t("state.empty.body")}
            action={
              <Link to={pathTo("S05")} className={buttonClass("primary")}>
                {t("state.empty.action")}
              </Link>
            }
          />
        </>
      ) : (
        <Columns
          main={
            <div className="flex flex-col gap-4">
              <Hero data={data} />
              {short ? <ShortList data={data} /> : <TodayList data={data} />}
            </div>
          }
          aside={aside}
        />
      )}
    </Frame>
  );
}
