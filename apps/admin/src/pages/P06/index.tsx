// P06 变更影响分析（平台后台简版：主视图＋七态＋P0 功能点；增强功能的入口先提示“即将上线”，见 W03 交接单）。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { param } from "@exam-prep/params";
import { Banner, Button, Columns, ContainerScope, PageHeader, PageState, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { Link, useLocation } from "../../router/history.tsx";
import { pathTo } from "../../routes.ts";
import { EventTable } from "./components/EventTable.tsx";
import { ImpactSkeleton } from "./components/ImpactSkeleton.tsx";
import { KindFilters } from "./components/KindFilters.tsx";
import { NoticeCard } from "./components/NoticeCard.tsx";
import { useChangeImpact, type KindFilter } from "./data.ts";

export default function Page() {
  const { t } = useTranslation("P06");
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const toast = useToast();
  const [kind, setKind] = useState<KindFilter>("all");
  const impact = useChangeImpact({ exam: query.get("exam") ?? "kj", state: query.get("state") ?? "normal", kind });
  const data = impact.data;
  const soon = () => toast(t("soon"));
  const clearFilters = () => {
    setKind("all");
    impact.retry();
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
            </span>
          )
        }
        actions={
          impact.state === "restricted" ? undefined : (
            // feat:P06-02 变更事件登记：须附官方文件与生效时间（要后端与权限，先提示“即将上线”）。
            <Button variant="primary" onClick={soon}>
              {t("actions.register")}
            </Button>
          )
        }
      />
      {impact.state !== "restricted" && <KindFilters data={data} kind={kind} onKind={setKind} />}
      {impact.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("title")}
          skeleton={<ImpactSkeleton />}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        />
      ) : impact.state === "offline" ? (
        <PageState
          state="offline"
          pageName={t("title")}
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={impact.retry}>{t("state.offline.action")}</Button>}
        />
      ) : impact.state === "restricted" ? (
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
      ) : impact.state === "error" || data === undefined ? (
        <PageState
          state="error"
          pageName={t("title")}
          audience="staff"
          body={t("state.error.body")}
          onRetry={impact.retry}
          onReport={soon}
        />
      ) : (
        <>
          {impact.stale && <Banner tone="warning" title={t("state.offline.stale")} />}
          {impact.state === "empty" ? (
            <PageState
              state="empty"
              title={t("state.empty.title")}
              body={t("state.empty.body")}
              action={
                <Button variant="primary" onClick={clearFilters}>
                  {t("state.empty.action")}
                </Button>
              }
            />
          ) : (
            <Columns main={<EventTable data={data} onAssign={soon} />} aside={<NoticeCard onNotify={soon} />} />
          )}
        </>
      )}
    </ContainerScope>
  );
}
