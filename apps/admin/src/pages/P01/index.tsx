// P01 运营驾驶舱（平台后台简版：主视图＋七态＋P0 功能点；暂缓的 P1 见 W01 交接单）。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { P01CohortDimension } from "@exam-prep/contract";
import { param } from "@exam-prep/params";
import { formatDate } from "@exam-prep/shared";
import { Banner, Button, ContainerScope, PageHeader, PageState, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { Link, useLocation } from "../../router/history.tsx";
import { pathTo } from "../../routes.ts";
import { CockpitContent } from "./components/CockpitContent.tsx";
import { CockpitSkeleton } from "./components/CockpitSkeleton.tsx";
import { DEFAULT_DIMENSION, useCockpit } from "./data.ts";

export default function Page() {
  const { t } = useTranslation("P01");
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const toast = useToast();
  const [dimension, setDimension] = useState<P01CohortDimension>(DEFAULT_DIMENSION);
  const cockpit = useCockpit({ exam: query.get("exam") ?? "kj", state: query.get("state") ?? "normal", dimension });
  const data = cockpit.data;
  const soon = () => toast(t("soon"));
  const resetFilters = () => {
    setDimension(DEFAULT_DIMENSION);
    cockpit.retry();
  };
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={
          data === undefined ? undefined : (
            <span className="flex flex-wrap gap-1">
              {data.data_source === "sample" && <Tag size="sm">{t("sample")}</Tag>}
              <Tag size="sm" tone="outline">
                {t("scope", { exam: data.exam_name })}
              </Tag>
              <Tag size="sm" tone="outline">
                {t("period", { start: formatDate(data.period_start), end: formatDate(data.period_end) })}
              </Tag>
            </span>
          )
        }
        actions={
          data !== undefined && cockpit.state !== "empty" ? (
            <Tag tone="warning">{t("alertsBadge", { n: data.open_alert_count })}</Tag>
          ) : undefined
        }
      />
      {cockpit.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("title")}
          skeleton={<CockpitSkeleton />}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        />
      ) : cockpit.state === "offline" ? (
        <PageState
          state="offline"
          pageName={t("title")}
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={cockpit.retry}>{t("state.offline.action")}</Button>}
        />
      ) : cockpit.state === "restricted" ? (
        <PageState
          state="restricted"
          title={t("state.restricted.title")}
          body={t("state.restricted.body")}
          action={
            <Link to={pathTo("P19")} className={buttonClass("secondary")}>
              {t("state.restricted.action")}
            </Link>
          }
        />
      ) : cockpit.state === "error" || data === undefined ? (
        <PageState
          state="error"
          pageName={t("title")}
          audience="staff"
          body={t("state.error.body")}
          onRetry={cockpit.retry}
          onReport={soon}
        />
      ) : cockpit.state === "empty" ? (
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={
            <Button variant="primary" onClick={resetFilters}>
              {t("state.empty.action")}
            </Button>
          }
        />
      ) : (
        <>
          {cockpit.stale && <Banner tone="warning" title={t("state.offline.stale")} />}
          <CockpitContent data={data} dimension={dimension} onDimension={setDimension} onHandle={soon} />
        </>
      )}
    </ContainerScope>
  );
}
