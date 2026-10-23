import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { formatDate, formatDuration } from "@exam-prep/shared/format";
import type { S08Period } from "@exam-prep/contract";
import { Banner, Button, ContainerScope, PageHeader, PageState, Skeleton, Tabs, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { useRecap } from "./data.ts";
import { ReportView } from "./views/ReportView.tsx";

export default function Page() {
  const { t } = useTranslation("S08");
  const toast = useToast();
  const [search, setSearch] = useSearchParams();
  const requested = search.get("view");
  const view: S08Period = requested === "month" || requested === "round" ? requested : "week";
  const recap = useRecap(view);
  const data = recap.data;
  function changeView(next: S08Period) {
    const query = new URLSearchParams(search);
    query.set("view", next);
    setSearch(query);
  }
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        eyebrow={data?.exam_name}
        meta={
          <>
            <Tag tone="brand">{t("self_only")}</Tag>
            <Tag tone="warning">{t("sample")}</Tag>
            {data && <span>{t("range", { start: formatDate(data.period_start), end: formatDate(data.period_end) })}</span>}
          </>
        }
      />
      <Tabs
        label={t("period")}
        items={(["week", "month", "round"] as const).map((key) => ({ key, label: t(`views.${key}`) }))}
        value={view}
        onChange={changeView}
      />
      {recap.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("title")}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={
            <div className="grid gap-4">
              <Skeleton title lines={2} />
              <Skeleton lines={1} />
              <Skeleton title block lines={4} />
              <Skeleton title block lines={4} />
            </div>
          }
        />
      ) : recap.state === "offline" && data === undefined ? (
        <PageState
          state="offline"
          pageName={t("title")}
          body={`${t("state.offline.body")}。${t("state.offline.missing")}`}
          action={<Button onClick={recap.retry}>{t("retry")}</Button>}
        />
      ) : data === undefined ? (
        <PageState
          state="error"
          pageName={t("title")}
          body={t("state.error.body")}
          onRetry={recap.retry}
          onReport={() => toast(t("soon"))}
        />
      ) : recap.state === "empty" ? (
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body", { days: data.minimum_days })}
          action={
            <Link to={pathTo("S06")} className={buttonClass("primary")}>
              {t("state.empty.action")}
            </Link>
          }
        />
      ) : (
        <>
          {recap.offline && (
            <Banner tone="warning" title={t("state.offline.title")}>
              <PageState state="offline" body={t("state.offline.body")} />
            </Banner>
          )}
          {recap.state === "insufficient_data" && (
            <PageState
              state="insufficient_data"
              title={t("state.insufficient_data.title")}
              body={t("state.insufficient_data.body", { duration: formatDuration(data.minimum_minutes) })}
            />
          )}
          <ReportView data={data} offline={recap.offline} />
        </>
      )}
    </ContainerScope>
  );
}
