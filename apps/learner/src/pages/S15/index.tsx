import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { formatCount } from "@exam-prep/shared/format";
import { Button, ContainerScope, Dialog, PageHeader, PageState, Skeleton, Tag, buttonClass } from "@exam-prep/ui";
import { useShellPage } from "../../app/page-context.tsx";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { useReviewHome } from "./data.ts";
import { CARD_KINDS, HomeView } from "./views/HomeView.tsx";
import { SessionView } from "./views/SessionView.tsx";
import "./style.css";

export default function Page() {
  const { t } = useTranslation("S15");
  const toast = useToast();
  const home = useReviewHome();
  const shell = useShellPage();
  const [search, setSearch] = useSearchParams();
  const [create, setCreate] = useState(false);
  const [source, setSource] = useState("point");
  const [kind, setKind] = useState<string>("qa");
  const title = t("title");
  const soon = () => toast(t("soon"));
  function changeView(view: "home" | "session") {
    shell.setView(view);
    if (search.has("view")) {
      const next = new URLSearchParams(search);
      next.set("view", view);
      setSearch(next);
    }
  }
  const header = (
    <PageHeader
      title={title}
      description={t("subtitle")}
      eyebrow={home.data?.exam_name}
      meta={<Tag>{t("sample")}</Tag>}
      actions={
        <>
          <Button variant="secondary" onClick={() => setCreate(true)}>
            {t("ai")}
          </Button>
          <Link to={pathTo("S33")} className={buttonClass("ghost")}>
            {t("settings")}
          </Link>
        </>
      }
    />
  );
  let body;
  if (home.state === "loading")
    body = (
      <PageState
        state="loading"
        pageName={title}
        slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton title lines={2} />
            <Skeleton block lines={4} />
            <Skeleton title lines={3} />
          </div>
        }
      />
    );
  else if (home.state === "offline" && home.data === undefined)
    body = (
      <PageState
        state="offline"
        pageName={title}
        title={t("state.offline.title")}
        body={t("state.offline.body")}
        action={<Button onClick={home.retry}>{t("state.offline.retry")}</Button>}
      />
    );
  else if (home.state === "error") body = <PageState state="error" pageName={title} onRetry={home.retry} onReport={soon} />;
  else if (home.data === undefined)
    body = (
      <PageState
        state="restricted"
        title={t("state.restricted.title")}
        body={t("state.restricted.body")}
        action={<Button onClick={home.retry}>{t("state.offline.retry")}</Button>}
      />
    );
  else if (home.state === "empty")
    body = (
      <>
        {header}
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body", { n: formatCount(home.data.queue.tomorrow) })}
          action={
            <Link to={pathTo("S06")} className={buttonClass("primary")}>
              {t("state.empty.action")}
            </Link>
          }
        />
      </>
    );
  else
    body = (
      <>
        {home.stale && <PageState compact state="offline" title={t("state.offline.title")} body={t("policy.offline_body")} />}
        {home.state === "restricted" && (
          <PageState compact state="restricted" title={t("state.restricted.title")} body={t("state.restricted.body")} />
        )}
        {home.state === "insufficient_data" && (
          <PageState
            compact
            state="insufficient_data"
            title={t("state.insufficient_data.title")}
            body={t("state.insufficient_data.body", { n: formatCount(home.data.policy.insufficient_threshold) })}
          />
        )}
        {shell.view?.key === "session" ? (
          <SessionView data={home.data} onExit={() => changeView("home")} />
        ) : (
          <>
            {header}
            <HomeView data={home.data} onStart={() => changeView("session")} />
          </>
        )}
      </>
    );
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      {body}
      {/* feat:S15-05 知识点、讲解、选中文字、笔记、错题五个制卡入口。 */}
      <Dialog
        open={create}
        title={t("create.title")}
        onClose={() => setCreate(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreate(false)}>
              {t("pending.cancel")}
            </Button>
            <Button onClick={soon}>{t("create.generate")}</Button>
          </>
        }
      >
        <p>{t("create.body")}</p>
        <div className="mt-4 flex flex-col gap-4">
          <label>
            {t("create.source")}
            <select
              className="mt-2 w-full rounded-sm border border-line-strong bg-bg-surface p-3"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              {["point", "explanation", "selection", "note", "mistake"].map((value) => (
                <option key={value} value={value}>
                  {t(`create.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("create.type")}
            <select
              className="mt-2 w-full rounded-sm border border-line-strong bg-bg-surface p-3"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {CARD_KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(`kind.${value}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Dialog>
    </ContainerScope>
  );
}
