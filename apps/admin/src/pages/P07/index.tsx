// P07 内容生产流水线（平台后台简版：主视图＋七态＋P0 功能点；暂缓的 P1 见 W04 交接单）。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { param } from "@exam-prep/params";
import { formatDateTime } from "@exam-prep/shared";
import { Banner, Button, ContainerScope, PageHeader, PageState, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { Link, useLocation } from "../../router/history.tsx";
import { pathTo } from "../../routes.ts";
import { PipelineContent } from "./components/PipelineContent.tsx";
import { PipelineSkeleton } from "./components/PipelineSkeleton.tsx";
import { usePipeline, type KindFilter } from "./data.ts";

export default function Page() {
  const { t } = useTranslation("P07");
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const toast = useToast();
  const [kind, setKind] = useState<KindFilter>("all");
  const pipeline = usePipeline({ exam: query.get("exam") ?? "kj", state: query.get("state") ?? "normal", kind });
  const data = pipeline.data;
  const soon = () => toast(t("soon"));
  const resetFilters = () => {
    setKind("all");
    pipeline.retry();
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
                {t("updated", { time: formatDateTime(data.generated_at, data.time_zone) })}
              </Tag>
            </span>
          )
        }
      />
      {pipeline.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("title")}
          skeleton={<PipelineSkeleton />}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        />
      ) : pipeline.state === "offline" ? (
        <PageState
          state="offline"
          pageName={t("title")}
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={pipeline.retry}>{t("state.offline.action")}</Button>}
        />
      ) : pipeline.state === "restricted" ? (
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
      ) : pipeline.state === "error" || data === undefined ? (
        <PageState
          state="error"
          pageName={t("title")}
          audience="staff"
          body={t("state.error.body")}
          onRetry={pipeline.retry}
          onReport={soon}
        />
      ) : pipeline.state === "empty" ? (
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
          {pipeline.stale && <Banner tone="warning" title={t("state.offline.stale")} />}
          <PipelineContent data={data} kind={kind} onKind={setKind} onSoon={soon} />
        </>
      )}
    </ContainerScope>
  );
}
