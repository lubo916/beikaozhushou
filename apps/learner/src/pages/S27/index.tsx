import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { formatCount, formatDate, formatDays } from "@exam-prep/shared/format";
import { Banner, Card, ContainerScope, PageHeader, PageState, Skeleton, Tabs, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { useSprintHome } from "./data.ts";
import { SprintView } from "./views/SprintView.tsx";
import { AfterView } from "./views/AfterView.tsx";
import { Checklist } from "./components/Checklist.tsx";

export default function Page() {
  const { t } = useTranslation("S27");
  const [search, setSearch] = useSearchParams();
  const view = search.get("view") === "after" ? "after" : "sprint";
  const home = useSprintHome();
  const toast = useToast();
  const data = home.data;
  const soon = () => toast(t("soon"));
  const restricted = home.state === "restricted" || data?.availability === "exam_day";
  let content;
  if (home.state === "loading")
    content = (
      <PageState
        state="loading"
        pageName={t("title")}
        slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton title lines={3} block />
            <Skeleton title lines={4} block />
            <Skeleton title lines={3} block />
          </div>
        }
      />
    );
  else if (home.state === "offline")
    content = (
      <PageState
        state="offline"
        pageName={t("title")}
        body={t("state.offline.body")}
        action={
          <Link to={pathTo("S14")} className={buttonClass("secondary")}>
            {t("state.offline.action")}
          </Link>
        }
      />
    );
  else if (restricted)
    content = (
      <div className="flex flex-col gap-4">
        <PageState state="restricted" title={t("state.restricted.title")} body={t("state.restricted.body")} />
        {data !== undefined && <Checklist data={data} soon={soon} />}
      </div>
    );
  else if (home.state === "error" || data === undefined)
    content = <PageState state="error" pageName={t("title")} onRetry={home.retry} onReport={() => toast(t("feedback"))} />;
  else if (home.state === "empty")
    content = (
      <PageState
        state="empty"
        title={t("state.empty.title")}
        body={t("state.empty.body", { days: formatCount(data.sprint_window_days) })}
        action={
          <Link to={pathTo("S06")} className={buttonClass("primary")}>
            {t("state.empty.action")}
          </Link>
        }
      />
    );
  else content = view === "after" ? <AfterView data={data} soon={soon} /> : <SprintView data={data} soon={soon} />;

  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("title")}
        description={data === undefined ? t("description") : data.exam_name}
        meta={
          data !== undefined && (
            <>
              <Tag>{t("countdown", { days: formatDays(data.days_to_exam) })}</Tag>
              <Tag>{t("exam_date", { date: formatDate(data.exam_day) })}</Tag>
              {data.data_source === "sample" && <Tag tone="warning">{t("sample")}</Tag>}
            </>
          )
        }
      />
      <Tabs
        label={t("views.label")}
        value={view}
        items={[
          { key: "sprint", label: t("views.sprint") },
          { key: "after", label: t("views.after") },
        ]}
        onChange={(key) => {
          const next = new URLSearchParams(search);
          next.set("view", key);
          setSearch(next);
        }}
      >
        <div className="flex flex-col gap-4">
          {home.stale && (
            <Banner tone="warning" title={t("state.offline.stale")}>
              {t("state.offline.body")}
            </Banner>
          )}
          {data !== undefined && home.state === "normal" && !restricted && view === "sprint" && !data.calibration_ready && (
            <Card title={t("after.compare.title")}>
              <PageState state="insufficient_data" title={t("state.insufficient_data.title")} body={t("state.insufficient_data.body")} />
            </Card>
          )}
          {content}
        </div>
      </Tabs>
    </ContainerScope>
  );
}
