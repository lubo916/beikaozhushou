// S18 做题与解析（U18a 上半：共用作答组件与做题主流程；下半 U18b 补分层解析、提示阶梯、错因确认与讲解入口）。
// 页面只管显示：数据经 data.ts 里生成的钩子拿；七态由接口层制造，这里按请求结果选显示哪一态（?state= 不用页面写分支）。
// 两个视图：obj 客观题、gen 生成题（先做后核）；真实使用时按题组来源选视图（setView），开发与测试时 ?view= 优先。
// 沉浸页：外壳顶栏只留退出与页名，题组名、模式、题号、计时由页面用 ImmersiveProgress 放进顶栏右侧。
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { param } from "@exam-prep/params";
import { Banner, Button, COPY, ContainerScope, PageState, buttonClass } from "@exam-prep/ui";
import { useShellPage } from "../../app/page-context.tsx";
import { useToast } from "../../app/toast.tsx";
import { DEMO_PARAM, pathTo } from "../../routes.ts";
import { QuizSkeleton } from "./components/QuizSkeleton.tsx";
import { SessionHeader } from "./components/SessionHeader.tsx";
import { SummaryCard } from "./components/SummaryCard.tsx";
import { VIEW_GENERATED, sessionIdFor, useQuizSession, viewOfKind } from "./data.ts";
import { GeneratedView } from "./views/GeneratedView.tsx";
import { ObjectiveView } from "./views/ObjectiveView.tsx";

/** 页面内容区：容器查询的作用域（里面的组件按这块区域的宽度切换布局）。 */
function Frame({ children }: { children: ReactNode }) {
  return <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">{children}</ContainerScope>;
}

export default function Page() {
  const { t } = useTranslation("S18");
  const { t: tc } = useTranslation();
  const toast = useToast();
  const shell = useShellPage();
  const { sessionId = DEMO_PARAM } = useParams();
  const id = sessionIdFor(sessionId, shell.view?.key);
  const session = useQuizSession(id);
  const pageName = tc("page.S18");
  const data = session.data;
  const kind = data?.kind;
  const { setView } = shell;
  // 这次打开后交过题：做完最后一题也留在做题页看揭晓与小结，不跳成“这一组题做完了”
  const [started, setStarted] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    if (kind !== undefined) setView(viewOfKind(kind));
  }, [kind, setView]);

  if (session.state === "loading") {
    return (
      <Frame>
        <PageState
          state="loading"
          pageName={pageName}
          skeleton={<QuizSkeleton />}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        />
      </Frame>
    );
  }
  if (session.state === "offline") {
    return (
      <Frame>
        <PageState
          state="offline"
          pageName={pageName}
          body={t("state.offline.body")}
          action={
            <Link to={pathTo("S17")} className={buttonClass("secondary")}>
              {t("state.offline.action")}
            </Link>
          }
        />
      </Frame>
    );
  }
  if (session.state === "restricted") {
    return (
      <Frame>
        <PageState
          state="restricted"
          pageName={pageName}
          title={t("state.restricted.page_title")}
          body={t("state.restricted.page_body")}
          action={
            <Link to={pathTo("S17")} className={buttonClass("secondary")}>
              {t("state.restricted.page_action")}
            </Link>
          }
        />
      </Frame>
    );
  }
  if (session.state === "error" || data === undefined) {
    return (
      <Frame>
        <PageState state="error" pageName={pageName} onRetry={session.retry} onReport={() => toast(t("soon.report_page"))} />
      </Frame>
    );
  }
  const viewProps = { session: data, sessionId: id, onStarted: () => setStarted(true) };
  return (
    <Frame>
      {/* feat:S18-27 离线作答：有已下载的题照常做，顶上说明联网后计入证据 */}
      {session.stale && (
        <Banner
          tone="warning"
          title={t("state.offline.stale")}
          action={
            <Button size="sm" onClick={session.retry}>
              {COPY.action.retry}
            </Button>
          }
        >
          {t("state.offline.body")}
        </Banner>
      )}
      {session.state === "empty" && !started ? (
        <>
          <SessionHeader session={data} />
          <PageState
            state="empty"
            title={t("state.empty.title")}
            body={t("state.empty.body")}
            action={
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => setSummaryOpen(true)}>
                  {t("state.empty.action")}
                </Button>
                <Link to={pathTo("S17")} className={buttonClass("secondary")}>
                  {t("state.empty.again")}
                </Link>
              </div>
            }
          />
          {summaryOpen && <SummaryCard session={data} />}
        </>
      ) : shell.view?.key === VIEW_GENERATED ? (
        <GeneratedView {...viewProps} />
      ) : (
        <ObjectiveView {...viewProps} />
      )}
    </Frame>
  );
}
