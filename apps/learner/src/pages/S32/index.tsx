import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { Banner, Button, Card, ContainerScope, Dialog, PageHeader, PageState, Skeleton, Tabs, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { ExportDialog } from "./components/ExportDialog.tsx";
import { usePrivacyCenter } from "./data.ts";
import { AccountView } from "./views/AccountView.tsx";
import { AssetsView } from "./views/AssetsView.tsx";
import { PrivacyView } from "./views/PrivacyView.tsx";
const VIEWS = ["privacy", "assets", "account"] as const;
type View = (typeof VIEWS)[number];
interface Confirmation {
  readonly kind: string;
  readonly values: Record<string, string | number>;
}
export default function Page() {
  const { t } = useTranslation("S32");
  const [search, setSearch] = useSearchParams();
  const raw = search.get("view");
  const view: View = VIEWS.find((key) => key === raw) ?? "privacy";
  const home = usePrivacyCenter();
  const toast = useToast();
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const soon = () => toast(t("common.soon"));
  const data = home.data;
  const canWrite = data !== undefined && !home.stale && home.state !== "empty" && home.state !== "error" && home.state !== "offline";
  const blocked = () => toast(t(home.stale || home.state === "offline" ? "state.offline.body" : "state.access.body"));
  // 缓存离线仍可查看；所有视图共用操作闸门，避免页内入口绕过页头禁用。
  const confirm = (kind: string, values: Record<string, string | number> = {}) => {
    if (!canWrite) {
      blocked();
      return;
    }
    setConfirmation({ kind, values });
  };
  const exportData = () => {
    if (!canWrite) {
      blocked();
      return;
    }
    setExportOpen(true);
  };
  const perform = () => {
    if (canWrite) soon();
    else blocked();
  };
  const props = data === undefined ? undefined : { data, confirm, soon: perform, exportData };
  const selectView = (key: View) => {
    const next = new URLSearchParams(search);
    next.set("view", key);
    setSearch(next);
  };
  const content = () => {
    if (home.state === "loading")
      return (
        <PageState
          state="loading"
          pageName={t("title")}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={
            <div className="grid gap-4">
              <Card title={t("state.loading")}>
                <Skeleton lines={4} />
              </Card>
              <Card>
                <Skeleton lines={4} />
              </Card>
            </div>
          }
        />
      );
    if (home.state === "offline")
      return (
        <PageState
          state="offline"
          pageName={t("title")}
          body={t("state.offline.body")}
          action={<Button onClick={home.retry}>{t("state.offline.action")}</Button>}
        />
      );
    if (home.state === "error")
      return (
        <PageState
          state="error"
          pageName={t("title")}
          title={t("state.error.title")}
          body={t("state.error.body")}
          onRetry={home.retry}
          onReport={soon}
        />
      );
    if (data === undefined || props === undefined)
      return (
        <PageState
          state="restricted"
          pageName={t("title")}
          title={t("state.access.title")}
          body={t("state.access.body")}
          action={
            <Link to={pathTo("S33")} className={buttonClass("secondary")}>
              {t("common.settings")}
            </Link>
          }
        />
      );
    if (home.state === "empty")
      return (
        <PageState
          state="empty"
          pageName={t("title")}
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={
            <Link to={pathTo("S06")} className={buttonClass("primary")}>
              {t("state.empty.action")}
            </Link>
          }
        />
      );
    return (
      <div className="flex flex-col gap-4">
        {home.stale && (
          <Banner tone="warning" title={t("state.offline.cached")}>
            {t("state.offline.body")}
          </Banner>
        )}
        {home.state === "restricted" && view !== "account" && (
          <PageState
            compact
            state="restricted"
            title={t("state.restricted.title")}
            body={t("state.restricted.body", { days: data.cooling_days })}
            action={<Button onClick={() => selectView("account")}>{t("tabs.account")}</Button>}
          />
        )}
        {home.state === "insufficient_data" && (
          <PageState
            compact
            state="insufficient_data"
            title={t("state.insufficient_data.title")}
            body={t("state.insufficient_data.body")}
          />
        )}
        {view === "privacy" && <PrivacyView {...props} />}
        {view === "assets" && <AssetsView {...props} />}
        {view === "account" && <AccountView {...props} />}
      </div>
    );
  };
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={data?.data_source === "sample" ? <Tag>{t("sample")}</Tag> : undefined}
        actions={
          <Button
            variant="primary"
            disabled={
              data === undefined ||
              home.state === "loading" ||
              home.state === "offline" ||
              home.state === "error" ||
              home.state === "empty" ||
              home.stale
            }
            onClick={exportData}
          >
            {t("export.all")}
          </Button>
        }
      />
      <Tabs label={t("view_label")} items={VIEWS.map((key) => ({ key, label: t("tabs." + key) }))} value={view} onChange={selectView}>
        {content()}
      </Tabs>
      <ExportDialog
        open={exportOpen && canWrite}
        close={() => setExportOpen(false)}
        confirm={() => {
          setExportOpen(false);
          perform();
        }}
      />
      <Dialog
        open={confirmation !== null && canWrite}
        onClose={() => setConfirmation(null)}
        title={confirmation === null ? "" : t("confirm." + confirmation.kind + ".title")}
        description={confirmation === null ? "" : t("confirm." + confirmation.kind + ".body", confirmation.values)}
        actions={
          <>
            <Button onClick={() => setConfirmation(null)}>{t("common.cancel")}</Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmation(null);
                perform();
              }}
            >
              {t("common.confirm")}
            </Button>
          </>
        }
      />
    </ContainerScope>
  );
}
