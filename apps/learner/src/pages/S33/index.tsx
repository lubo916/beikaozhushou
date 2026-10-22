import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { Banner, Button, ContainerScope, PageHeader, PageState, Tabs, Tag } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { useSettings } from "./data.ts";
import { SettingsPanel } from "./views/SettingsPanel.tsx";
import "./settings.css";

const VIEWS = ["learning", "tutor", "reminders", "appearance", "account"] as const;
export default function Page() {
  const { t } = useTranslation("S33");
  const toast = useToast();
  const [search, setSearch] = useSearchParams();
  const settings = useSettings();
  const view = VIEWS.find((key) => key === search.get("view")) ?? "learning";
  const data = settings.data;
  const showDefaults = () => {
    const next = new URLSearchParams(search);
    next.delete("state");
    setSearch(next);
  };
  return (
    <ContainerScope className="s33-settings mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        meta={data?.data_source === "sample" ? <Tag tone="warning">{t("sample")}</Tag> : undefined}
      />
      {settings.stale && (
        <Banner tone="warning" title={t("state.offline.title")}>
          {t("state.offline.body")}
        </Banner>
      )}
      {settings.state === "loading" ? (
        <PageState state="loading" pageName={t("title")} slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")} />
      ) : settings.state === "error" ? (
        <PageState
          state="error"
          pageName={t("title")}
          body={t("state.error.body")}
          onRetry={settings.retry}
          onReport={() => toast(t("soon"))}
        />
      ) : settings.state === "offline" ? (
        <PageState
          state="offline"
          title={t("state.offline.title")}
          body={
            <>
              {t("state.offline.body")} {t("state.offline.no_cache")}
            </>
          }
          action={<Button onClick={settings.retry}>{t("retry")}</Button>}
        />
      ) : data === undefined ? (
        <PageState
          state="restricted"
          title={t("state.restricted.title")}
          body={t("state.restricted.body")}
          action={<Button onClick={showDefaults}>{t("reset")}</Button>}
        />
      ) : (
        <>
          {settings.state === "empty" && (
            <PageState
              state="empty"
              title={t("state.empty.title")}
              body={t("state.empty.body")}
              action={<Button onClick={showDefaults}>{t("reset")}</Button>}
            />
          )}
          {settings.state === "restricted" && (
            <PageState
              compact
              state="restricted"
              title={t("state.restricted.title")}
              body={t("state.restricted.body")}
              action={<Button onClick={showDefaults}>{t("state.restricted.action")}</Button>}
            />
          )}
          {settings.state === "insufficient_data" && (
            <PageState
              compact
              state="insufficient_data"
              title={t("state.insufficient_data.title")}
              body={t("state.insufficient_data.body")}
            />
          )}
          <p className="text-small text-ink-secondary">{t("hint.preview")}</p>
          <Tabs
            label={t("tabs_label")}
            items={VIEWS.map((key) => ({ key, label: t(`tabs.${key}`) }))}
            value={view}
            onChange={(key) => {
              const next = new URLSearchParams(search);
              next.set("view", key);
              setSearch(next);
            }}
          >
            {data.groups
              .filter((group) => group.id === view)
              .map((group) => (
                <SettingsPanel key={group.id} group={group} data={data} />
              ))}
          </Tabs>
        </>
      )}
    </ContainerScope>
  );
}
