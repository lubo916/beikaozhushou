// S04 摸底诊断（U04）：开始页（引导页）与测评中（沉浸页）两个视图；数据来自生成的钩子＋假数据层，页面里不做业务计算。
// 页面只管显示：七态由接口层制造，这里按 data.ts 的判断选一态；视图由接口回的 view 决定（开发时地址里的 ?view= 优先，ui-rules 第 5 节）。
// 原型：python3 tools/bk.py spec S04、python3 tools/bk.py proto S04 --views。规则：docs/baseline/rule-cards/diagnosis-start.md。
import { useCallback, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { ContainerScope, PageState } from "@exam-prep/ui";
import { useShellPage } from "../../app/page-context.tsx";
import { useToast } from "../../app/toast.tsx";
import { DiagnosisSkeleton } from "./components/DiagnosisSkeleton.tsx";
import { VIEW_TEST, forcedView, useDiagnosis } from "./data.ts";
import { StartView } from "./views/StartView.tsx";
import { TestView } from "./views/TestView.tsx";

/** 页面内容区：容器查询的作用域（里面的组件按这块区域的宽度切换布局）。 */
function Frame({ children }: { children: ReactNode }) {
  return <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">{children}</ContainerScope>;
}

export default function Page() {
  const { t } = useTranslation("S04");
  const { t: tc } = useTranslation();
  const toast = useToast();
  const { view, setView } = useShellPage();
  const [search, setSearch] = useSearchParams();
  const diagnosis = useDiagnosis(import.meta.env.DEV ? forcedView(search.get("view")) : undefined);
  const pageName = tc("page.S04");
  const data = diagnosis.data;
  const wanted = data?.view;

  useEffect(() => {
    if (wanted !== undefined) setView(wanted);
  }, [wanted, setView]);

  /** 用户的操作换了视图（开始、暂停、接着做）：去掉地址里开发用的 ?view=，视图跟着数据走。 */
  const release = useCallback(() => {
    if (!search.has("view")) return;
    setSearch(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("view");
        return next;
      },
      { replace: true },
    );
  }, [search, setSearch]);

  if (diagnosis.state === "loading") {
    return (
      <Frame>
        <PageState
          state="loading"
          pageName={pageName}
          skeleton={<DiagnosisSkeleton />}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        />
      </Frame>
    );
  }
  if (diagnosis.state === "offline") {
    return (
      <Frame>
        <PageState state="offline" pageName={pageName} body={t("state.offline.body")} onRetry={diagnosis.retry} />
      </Frame>
    );
  }
  if (diagnosis.state === "restricted") {
    return (
      <Frame>
        <PageState state="restricted" pageName={pageName} title={t("state.restricted.title")} body={t("state.restricted.body")} />
      </Frame>
    );
  }
  if (diagnosis.state === "error" || data === undefined) {
    return (
      <Frame>
        <PageState state="error" pageName={pageName} onRetry={diagnosis.retry} onReport={() => toast(t("soon.report"))} />
      </Frame>
    );
  }
  const session = data.session;
  return (
    <Frame>
      {view?.key === VIEW_TEST && session !== undefined ? (
        <TestView session={session} stale={diagnosis.stale} onRetry={diagnosis.retry} onLeave={release} />
      ) : (
        <StartView data={data} empty={diagnosis.state === "empty"} stale={diagnosis.stale} onRetry={diagnosis.retry} onLeave={release} />
      )}
    </Frame>
  );
}
