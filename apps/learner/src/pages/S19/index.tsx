import "./style.css";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { formatNumber } from "@exam-prep/shared/format";
import { Banner, Button, Card, ContainerScope, PageHeader, PageState, Stat, StatGroup, Tabs, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { useNotebook } from "./data.ts";
import { NotebookList } from "./views/NotebookList.tsx";
import { Insights } from "./views/Insights.tsx";
import { NotebookDialogs, type NotebookDialog } from "./components/NotebookDialogs.tsx";

export default function Page() {
  const { t } = useTranslation("S19");
  const toast = useToast();
  const [search, setSearch] = useSearchParams();
  const [dialog, setDialog] = useState<NotebookDialog>(null);
  const notebook = useNotebook();
  const requested = search.get("view");
  const view = requested === "all" ? "all" : ["insights", "insight"].includes(requested ?? "") ? "insights" : "today";
  const data = notebook.data;
  const header = (
    <PageHeader
      title={t("title")}
      description={data ? t("graduation", { ...data.graduation }) : t("subtitle")}
      actions={
        <>
          {/* feat:S19-18 纸质错题拍照导入 */}
          <Button onClick={() => setDialog("photo")}>{t("actions.photo")}</Button>
          {/* feat:S19-17 导出打印 */}
          <Button onClick={() => setDialog("export")}>{t("actions.export")}</Button>
        </>
      }
      meta={
        data && (
          <>
            <Tag tone="warning">{t("sample")}</Tag>
            <span>{t("fallback", { ...data.graduation })}</span>
          </>
        )
      }
    />
  );
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      {header}
      {notebook.state === "loading" ? (
        <PageState state="loading" pageName={t("title")} slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")} />
      ) : notebook.state === "offline" ? (
        <PageState
          state="offline"
          title={t("state.offline_title")}
          body={t("state.offline_body")}
          action={<Button onClick={notebook.retry}>{t("actions.reconnect")}</Button>}
        />
      ) : notebook.state === "error" || data === undefined ? (
        <PageState state="error" pageName={t("title")} onRetry={notebook.retry} onReport={() => toast(t("soon"))} />
      ) : (
        <>
          {notebook.stale && (
            <Banner tone="warning" title={t("state.offline_title")}>
              {t("state.offline_body")}
            </Banner>
          )}
          <StatGroup>
            {(["total", "today", "stubborn", "graduated"] as const).map((key) => (
              <Card key={key} as="div">
                <Stat
                  label={t(`stats.${key}`)}
                  value={formatNumber(data.stats[key], 0)}
                  hint={t(`stats.${key}_hint`)}
                  tone={key === "stubborn" ? "warning" : key === "graduated" ? "success" : "default"}
                />
              </Card>
            ))}
          </StatGroup>
          <Tabs
            label={t("title")}
            value={view}
            items={(["today", "all", "insights"] as const).map((value) => ({ key: value, label: t(`tabs.${value}`) }))}
            onChange={(value) => {
              const next = new URLSearchParams(search);
              next.set("view", value);
              next.delete("trap");
              setSearch(next);
            }}
          />
          {/* feat:S19-02 今日默认仅呈现接口标为到期的错题 */}
          {notebook.state === "empty" ? (
            <PageState
              state="empty"
              title={t("state.empty_title")}
              body={t("state.empty_body")}
              action={
                <Link to={pathTo("S17")} className={buttonClass("primary")}>
                  {t("actions.practice")}
                </Link>
              }
            />
          ) : view === "insights" ? (
            <Insights data={data} onAnalyze={() => setDialog("analysis")} />
          ) : (
            <NotebookList key={view} data={data} todayOnly={view === "today"} onAnalyze={() => setDialog("analysis")} />
          )}
          {view !== "insights" && (data.insights.restricted || !data.insights.available) && (
            <Insights data={data} compact onAnalyze={() => setDialog("analysis")} />
          )}
        </>
      )}
      <NotebookDialogs dialog={dialog} data={data} onClose={() => setDialog(null)} />
    </ContainerScope>
  );
}
