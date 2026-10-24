import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { param } from "@exam-prep/params";
import { Banner, Button, Columns, ContainerScope, PageHeader, PageState, Skeleton, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { useCalendar } from "./data.ts";
import { CalendarMain, CalendarAside } from "./components/CalendarCards.tsx";

function Frame({ children }: { children: ReactNode }) {
  return <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">{children}</ContainerScope>;
}

// S25 仅主视图（页面登记无其他视图）；?view=main 与默认地址显示相同内容。
export default function Page() {
  const { t } = useTranslation("S25");
  const toast = useToast();
  const home = useCalendar();
  const { data } = home;
  const add = () => toast(t("soon_node"));
  const header = (
    <PageHeader
      title={t("title")}
      description={t("description")}
      actions={
        <>
          {/* feat:S25-01 自建节点：权限与真实写接口未接，明确提示尚未新增。 */}
          <Button onClick={add}>{t("add_node")}</Button>
          <Link className={buttonClass("secondary")} to={pathTo("S02")}>
            {t("goals")}
          </Link>
        </>
      }
      meta={data?.data_source === "sample" ? <Tag tone="warning">{t("sample")}</Tag> : undefined}
    />
  );
  if (home.state === "loading")
    return (
      <Frame>
        {header}
        <PageState
          state="loading"
          pageName={t("title")}
          skeleton={<Skeleton title block />}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        />
      </Frame>
    );
  if (home.state === "offline")
    return (
      <Frame>
        {header}
        <PageState
          state="offline"
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={home.retry}>{t("retry")}</Button>}
        />
      </Frame>
    );
  if (home.state === "restricted" && data === undefined)
    return (
      <Frame>
        {header}
        <PageState
          state="restricted"
          title={t("state.restricted.title")}
          body={t("state.restricted.body")}
          action={<Button onClick={() => toast(t("soon"))}>{t("bind")}</Button>}
        />
      </Frame>
    );
  if (home.state === "error" || data === undefined)
    return (
      <Frame>
        {header}
        <PageState state="error" pageName={t("title")} onRetry={home.retry} onReport={() => toast(t("soon"))} />
      </Frame>
    );
  return (
    <Frame>
      {header}
      {home.stale && (
        <Banner tone="warning" title={t("state.offline.stale")}>
          {t("state.offline.body")}
        </Banner>
      )}
      {home.state === "empty" ? (
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={<Button onClick={add}>{t("add_node")}</Button>}
        />
      ) : (
        <>
          <Banner>{t("sample_note")}</Banner>
          {home.state === "insufficient_data" && (
            <PageState compact state="insufficient_data" title={t("state.insufficient.title")} body={t("state.insufficient.body")} />
          )}
          <Columns main={<CalendarMain data={data} />} aside={<CalendarAside data={data} restricted={home.state === "restricted"} />} />
        </>
      )}
    </Frame>
  );
}
