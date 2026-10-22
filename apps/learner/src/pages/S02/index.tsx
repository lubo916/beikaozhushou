import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S02ExamChoice } from "@exam-prep/contract";
import { param } from "@exam-prep/params";
import { Banner, Button, Columns, ContainerScope, PageHeader, PageState, Skeleton, Tag, buttonClass } from "@exam-prep/ui";
import { useShellPage } from "../../app/page-context.tsx";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { SelectionSummary } from "./components/SelectionSummary.tsx";
import { ProfileDialog } from "./components/ProfileDialog.tsx";
import { useGoals } from "./data.ts";
import { ManageView } from "./views/ManageView.tsx";
import { SelectView, type Source } from "./views/SelectView.tsx";
import "./s02.css";

export default function Page() {
  const { t } = useTranslation("S02");
  const { view } = useShellPage();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState<Source>("official");
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState<S02ExamChoice | null>(null);
  const [editing, setEditing] = useState(false);
  const [contents, setContents] = useState<readonly string[]>([]);
  const home = useGoals(query, category);
  const last = useRef(home.data);
  if (home.data !== undefined) last.current = home.data;
  const data = home.data ?? (home.state === "offline" ? last.current : undefined);
  const manage = view?.key === "manage";
  const select = !manage || adding;
  const offline = home.state === "offline" || home.stale;
  const previewChoice = source === "official" ? data?.catalog[0] : undefined;
  const pick = (selected: S02ExamChoice, selectedContents: readonly string[] = []) => {
    setEditing(false);
    setChoice(selected);
    setContents(selectedContents);
  };
  const openCustom = () => {
    setAdding(true);
    setSource("custom");
    setQuery("");
    setCategory("");
  };
  const chooseTarget = () => {
    setAdding(true);
    setSource("official");
    setQuery("");
    setCategory("");
  };
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      {/* feat:S02-10 首次只有三条来路；管理态显示我的目标。 */}
      <PageHeader
        title={t("title")}
        eyebrow={manage ? undefined : t("first_title")}
        description={t(manage ? "subtitle" : "first_subtitle")}
        meta={data?.data_source === "sample" ? <Tag tone="outline">{t("sample")}</Tag> : undefined}
        actions={
          manage && adding ? (
            <Button
              onClick={() => {
                setAdding(false);
                setQuery("");
                setCategory("");
              }}
            >
              {t("manage.back")}
            </Button>
          ) : undefined
        }
      />
      {home.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("title")}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={
            <>
              <Skeleton title lines={3} block />
              <Skeleton lines={3} block />
            </>
          }
        />
      ) : home.state === "error" ? (
        <PageState state="error" pageName={t("title")} onRetry={home.retry} onReport={() => toast(t("soon"))} />
      ) : (
        <>
          {offline && (
            <PageState
              state="offline"
              compact
              title={t("state.offline.title")}
              body={t("state.offline.body")}
              action={<Button onClick={home.retry}>{t("state.offline.retry")}</Button>}
            />
          )}
          {home.state === "restricted" && (
            <PageState
              state="restricted"
              title={t("state.restricted.title")}
              body={data === undefined ? t("state.restricted.generic") : t("state.restricted.body", { limit: data.guest_limit })}
              action={
                <>
                  <Link className={buttonClass("primary")} to={pathTo("S31")}>
                    {t("state.restricted.action")}
                  </Link>
                  <Link className={buttonClass("secondary")} to={pathTo("S01")}>
                    {t("state.restricted.login")}
                  </Link>
                </>
              }
            />
          )}
          {home.state === "empty" && !adding && (
            <PageState
              state="empty"
              title={t("state.empty.title")}
              body={t("state.empty.body")}
              action={
                <Button variant="primary" onClick={chooseTarget}>
                  {t("state.empty.action")}
                </Button>
              }
            />
          )}
          {home.state === "insufficient_data" && source !== "custom" && (
            <PageState
              state="insufficient_data"
              title={t("state.insufficient_data.title")}
              body={t("state.insufficient_data.body")}
              action={
                <Button variant="primary" onClick={openCustom}>
                  {t("state.insufficient_data.action")}
                </Button>
              }
            />
          )}
          {data !== undefined &&
            home.state !== "restricted" &&
            (home.state !== "empty" || adding) &&
            (home.state !== "insufficient_data" || source === "custom") && (
              <>
                {home.stale && (
                  <Banner tone="warning" title={t("state.offline.title")}>
                    {t("state.offline.body")}
                  </Banner>
                )}
                {select ? (
                  <Columns
                    main={
                      <SelectView
                        data={data}
                        source={source}
                        onSource={setSource}
                        query={query}
                        onQuery={setQuery}
                        category={category}
                        onCategory={setCategory}
                        onChoose={pick}
                        offline={offline}
                      />
                    }
                    aside={
                      previewChoice === undefined ? undefined : (
                        <SelectionSummary choice={previewChoice} offline={offline} onChoose={() => pick(previewChoice)} />
                      )
                    }
                  />
                ) : (
                  <ManageView
                    data={data}
                    onAdd={chooseTarget}
                    onEdit={(selected) => {
                      setEditing(true);
                      setContents([]);
                      setChoice(selected);
                    }}
                    offline={offline}
                  />
                )}
              </>
            )}
        </>
      )}
      {choice !== null && (
        <ProfileDialog key={choice.id} choice={choice} editing={editing} contents={contents} onClose={() => setChoice(null)} />
      )}
    </ContainerScope>
  );
}
