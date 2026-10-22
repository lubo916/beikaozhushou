import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { Banner, Button, ContainerScope, PageHeader, PageState, Tabs, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { usePracticeCenter } from "./data.ts";
import { PracticeDialog } from "./PracticeDialog.tsx";
import { BanksView, RecommendView, RecordsView, type DialogKind } from "./views/PracticeViews.tsx";
import "./styles.css";
type View = "recommend" | "banks" | "records";
export default function Page() {
  const { t } = useTranslation("S17");
  const toast = useToast();
  const [search, setSearch] = useSearchParams();
  const raw = search.get("view");
  const view: View = raw === "banks" || raw === "records" ? raw : "recommend";
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const home = usePracticeCenter();
  const data = home.data;
  const open = (kind: DialogKind) => {
    setMenu(false);
    setDialog(kind);
  };
  const header = (
    <PageHeader
      title={t("title")}
      description={t("subtitle")}
      meta={
        <>
          {data && <Tag>{data.exam_name}</Tag>}
          {data?.data_source === "sample" && <Tag tone="outline">{t("sample")}</Tag>}
        </>
      }
      actions={
        <Button variant="primary" aria-expanded={menu} aria-controls="s17-add-menu" onClick={() => setMenu(!menu)}>
          {t("add")}
        </Button>
      }
    />
  );
  let body;
  if (home.state === "loading")
    body = <PageState state="loading" pageName={t("title")} slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")} />;
  else if (home.state === "offline")
    body = (
      <PageState
        state="offline"
        title={t("state.offline.title")}
        body={t("state.offline.body")}
        action={<Button onClick={() => toast(t("soon"))}>{t("state.offline.action")}</Button>}
      />
    );
  else if (home.state === "restricted")
    body = (
      <PageState
        state="restricted"
        title={t("state.restricted.title")}
        body={t("state.restricted.body")}
        action={
          <Link to={pathTo("S31")} className={buttonClass()}>
            {t("state.restricted.action")}
          </Link>
        }
      />
    );
  else if (home.state === "error" || data === undefined)
    body = <PageState state="error" pageName={t("title")} onRetry={home.retry} onReport={() => toast(t("soon"))} />;
  else if (home.state === "empty")
    body = (
      <PageState
        state="empty"
        title={t("state.empty.title")}
        body={t("state.empty.body")}
        action={
          <Button variant="primary" onClick={() => setMenu(true)}>
            {t("state.empty.action")}
          </Button>
        }
      />
    );
  else
    body = (
      <Tabs
        label={t("tabsLabel")}
        value={view}
        items={["recommend", "banks", "records"].map((key) => ({ key: key as View, label: t("tabs." + key) }))}
        onChange={(key) =>
          setSearch((previous) => {
            previous.set("view", key);
            return previous;
          })
        }
      >
        {home.stale && (
          <Banner tone="warning" title={t("state.offline.title")}>
            {t("state.offline.body")}
          </Banner>
        )}
        {data.availability !== "normal" && view !== "recommend" && (
          <PageState
            compact
            state={data.availability === "restricted" ? "restricted" : "insufficient_data"}
            title={t("state." + data.availability + ".title")}
            body={t("state." + data.availability + ".body")}
            action={<Button onClick={() => open("newQuestion")}>{t("state.insufficient_data.action")}</Button>}
          />
        )}
        {view === "recommend" ? (
          <RecommendView data={data} open={open} />
        ) : view === "banks" ? (
          <BanksView data={data} open={open} />
        ) : (
          <RecordsView data={data} open={open} />
        )}
      </Tabs>
    );
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      {header}
      {menu && (
        <div id="s17-add-menu" className="s17-menu s17-row">
          {(["newQuestion", "photo", "import", "tutor"] as const).map((key) => (
            <Button key={key} onClick={() => open(key)}>
              {t(key)}
            </Button>
          ))}
          <Button variant="ghost" onClick={() => setMenu(false)}>
            {t("close")}
          </Button>
        </div>
      )}
      {body}
      {dialog !== null && <PracticeDialog kind={dialog} data={data} close={() => setDialog(null)} />}
    </ContainerScope>
  );
}
