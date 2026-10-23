import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { formatCount, formatPercent } from "@exam-prep/shared/format";
import {
  Banner,
  Button,
  Card,
  ContainerScope,
  PageHeader,
  PageState,
  Skeleton,
  Stat,
  StatGroup,
  Tabs,
  Tag,
  buttonClass,
} from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { ImportDialog } from "./components/ImportDialog.tsx";
import { useMaterialsWorkspace } from "./data.ts";
import { MaterialsView } from "./views/MaterialsView.tsx";
import { PendingView, HealthView, InboxView, TemplatesView } from "./views/WorkspaceViews.tsx";

const VIEWS = ["materials", "pending", "health", "inbox", "templates"] as const;
export type MaterialsViewKey = (typeof VIEWS)[number];

export default function Page() {
  const { t } = useTranslation("S11");
  const toast = useToast();
  const [search, setSearch] = useSearchParams();
  const requested = search.get("view");
  const view = VIEWS.find((key) => key === requested) ?? "materials";
  const [adding, setAdding] = useState(false);
  const home = useMaterialsWorkspace();
  const data = home.data;
  const changeView = (key: MaterialsViewKey) => {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      next.set("view", key);
      return next;
    });
  };
  const header = (
    <PageHeader
      title={t("title")}
      description={t("description")}
      actions={
        <Button variant="primary" onClick={() => setAdding(true)}>
          {t("actions.add")}
        </Button>
      }
      meta={data?.data_source === "sample" ? <Tag tone="outline">{t("sample")}</Tag> : undefined}
    />
  );
  const state = (name: "offline" | "restricted" | "insufficient_data") => (
    <PageState
      state={name}
      pageName={t("title")}
      title={t(`state.${name}.title`)}
      body={t(`state.${name}.body`)}
      action={
        name === "restricted" ? (
          <Link to={pathTo("S31")} className={buttonClass("secondary")}>
            {t("state.restricted.action")}
          </Link>
        ) : name === "insufficient_data" ? (
          <Button onClick={() => changeView("health")}>{t("state.insufficient_data.action")}</Button>
        ) : (
          <Button onClick={home.retry}>{t("actions.retry")}</Button>
        )
      }
    />
  );
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      {header}
      {home.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("title")}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={
            <>
              <StatGroup>
                <Skeleton block />
                <Skeleton block />
                <Skeleton block />
                <Skeleton block />
              </StatGroup>
              <Card>
                <Skeleton block />
              </Card>
            </>
          }
        />
      ) : home.state === "offline" && data === undefined ? (
        state("offline")
      ) : home.state === "error" ? (
        <PageState state="error" pageName={t("title")} onRetry={home.retry} onReport={() => toast(t("soon"))} />
      ) : data === undefined ? (
        state("restricted")
      ) : (
        <>
          {home.stale && (
            <Banner tone="warning" action={<Button onClick={home.retry}>{t("actions.retry")}</Button>}>
              {t("state.offline.body")}
            </Banner>
          )}
          {/* feat:S11-12 额度与存储数字由接口返回；受限只暂停新解析，保留已有资料。 */}
          <div className="grid grid-cols-2 gap-4 @content-md:grid-cols-4">
            <Card className="min-w-[0]">
              <Stat label={t("summary.coverage")} value={formatPercent(data.summary.coverage)} />
            </Card>
            <Card className="min-w-[0]">
              <Stat label={t("summary.pending")} value={formatCount(data.summary.pending)} />
            </Card>
            <Card className="min-w-[0]">
              <Stat
                label={t("summary.quota")}
                value={t("summary.quota_value", {
                  remaining: formatCount(data.summary.parse_remaining),
                  total: formatCount(data.summary.parse_total),
                })}
                hint={t("summary.storage", {
                  used: formatCount(data.summary.storage_used_mb),
                  limit: formatCount(data.summary.storage_limit_mb),
                })}
              />
            </Card>
            <Card className="min-w-[0]">
              <Stat label={t("summary.inbox")} value={formatCount(data.summary.inbox_count)} />
            </Card>
          </div>
          {home.state === "restricted" && state("restricted")}
          {home.state === "insufficient_data" && state("insufficient_data")}
          {home.state === "empty" ? (
            <PageState
              state="empty"
              title={t("state.empty.title")}
              body={t("state.empty.body")}
              action={
                <Button variant="primary" onClick={() => setAdding(true)}>
                  {t("state.empty.action")}
                </Button>
              }
            />
          ) : (
            <Tabs label={t("title")} items={VIEWS.map((key) => ({ key, label: t(`tabs.${key}`) }))} value={view} onChange={changeView}>
              {view === "materials" && <MaterialsView data={data} />}
              {view === "pending" && <PendingView data={data} />}
              {view === "health" && <HealthView data={data} />}
              {view === "inbox" && <InboxView data={data} />}
              {view === "templates" && <TemplatesView data={data} />}
            </Tabs>
          )}
        </>
      )}
      {/* feat:S11-11 版权边界与私有范围在上传前和页面上显式说明。 */}
      <p className="text-small text-ink-tertiary">{t("summary.private")}</p>
      {adding && <ImportDialog open onClose={() => setAdding(false)} preview={data?.import_preview} />}
    </ContainerScope>
  );
}
