import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { Banner, Button, PageState, Tag } from "@exam-prep/ui";
import { useShellPage } from "../../app/page-context.tsx";
import { useToast } from "../../app/toast.tsx";
import { DataUse } from "./components/WelcomeExtras.tsx";
import { useWelcome } from "./data.ts";
import { AbnormalView } from "./views/AbnormalView.tsx";
import { FirstView } from "./views/FirstView.tsx";
import { LoginView } from "./views/LoginView.tsx";
import "./welcome.css";

export default function Page() {
  const { t } = useTranslation("S01");
  const toast = useToast();
  const shell = useShellPage();
  const [search, setSearch] = useSearchParams();
  const welcome = useWelcome();
  const data = welcome.data;
  const [recovering, setRecovering] = useState(false);
  const requestedView = shell.view?.key ?? "first";
  // 受限账号可以进入独立登录或重设密码；查看恢复表单不解除账号限制。
  const view = welcome.state === "restricted" && !(recovering && requestedView === "back") ? "abn" : requestedView;

  function changeView(next: "first" | "back", reset = false) {
    setRecovering(next === "back");
    shell.setView(next);
    const params = new URLSearchParams(search);
    params.set("view", next);
    params.delete("issue");
    if (reset) params.set("auth", "reset");
    else params.delete("auth");
    setSearch(params);
  }

  return (
    <div data-testid="s01-page" data-view={view} className="s01-page mx-auto flex w-full flex-col gap-5 pb-6">
      {welcome.state === "loading" ? (
        <PageState state="loading" pageName={t("pageName")} slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")} />
      ) : welcome.state === "offline" ? (
        <>
          <header>
            <h1 className="font-serif text-title font-bold">{t("pageName")}</h1>
          </header>
          <PageState
            state="offline"
            title={t("state.offline.title")}
            body={t("state.offline.body")}
            action={<Button onClick={welcome.retry}>{t("retry")}</Button>}
          />
          <DataUse />
        </>
      ) : welcome.state === "error" || data === undefined ? (
        <PageState
          state={welcome.state === "restricted" ? "restricted" : "error"}
          pageName={t("pageName")}
          title={t(welcome.state === "restricted" ? "state.restricted.title" : "state.error.title")}
          body={t(welcome.state === "restricted" ? "state.restricted.body" : "state.error.body")}
          onRetry={welcome.retry}
          onReport={() => toast(t("soon"))}
        />
      ) : (
        <>
          {welcome.stale && (
            <Banner
              tone="warning"
              title={t("state.offline.title")}
              action={
                <Button size="sm" onClick={welcome.retry}>
                  {t("retry")}
                </Button>
              }
            >
              {t("state.offline.body")}
            </Banner>
          )}
          {welcome.state === "empty" && <PageState compact state="empty" title={t("state.empty.title")} body={t("state.empty.body")} />}
          {welcome.state === "insufficient_data" && (
            <PageState
              compact
              state="insufficient_data"
              title={t("state.insufficient_data.title")}
              body={t("state.insufficient_data.body")}
            />
          )}
          {view === "abn" ? (
            <>
              <header className="flex flex-col gap-3">
                <p className="text-small text-brand-primary">{t("pageName")}</p>
                <h1 className="font-serif text-title font-bold text-brand-primary-ink">{t("account.title")}</h1>
                <p className="text-ink-secondary">{t("account.body")}</p>
              </header>
              <AbnormalView data={data} onLogin={(reset) => changeView("back", reset)} />
            </>
          ) : view === "back" ? (
            <LoginView
              key={search.get("auth") ?? "login"}
              data={data}
              initialReset={search.get("auth") === "reset"}
              offline={welcome.stale}
              onBack={() => changeView("first")}
            />
          ) : (
            <FirstView data={data} offline={welcome.stale} onLogin={() => changeView("back")} />
          )}
          {data.data_source === "sample" && (
            <div className="flex justify-end">
              <Tag size="sm" tone="warning">
                {t("sample")}
              </Tag>
            </div>
          )}
        </>
      )}
    </div>
  );
}
