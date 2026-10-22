import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { param } from "@exam-prep/params";
import { Button, ContainerScope, PageHeader, PageState, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { useShellPage } from "../../app/page-context.tsx";
import { pathTo } from "../../routes.ts";
import { useStartReport } from "./data.ts";
import { ReportView } from "./views/ReportView.tsx";

export default function Page() {
  const { t } = useTranslation("S05");
  const { view } = useShellPage();
  const report = useStartReport(view?.key === "quick" ? "quick" : "normal");
  const toast = useToast();
  const data = report.data;
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("header.title")}
        description={t("header.description")}
        eyebrow={data === undefined ? undefined : t("header.subtitle", { exam: data.exam_name })}
        meta={data?.data_source === "sample" ? <Tag>{t("header.sample")}</Tag> : undefined}
      />
      {report.state === "loading" ? (
        <PageState state="loading" pageName={t("header.title")} slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")} />
      ) : report.state === "error" ? (
        <PageState
          state="error"
          pageName={t("header.title")}
          body={t("state.error.body")}
          onRetry={report.retry}
          onReport={() => toast(t("soon.report"))}
        />
      ) : report.state === "restricted" ? (
        <PageState
          state="restricted"
          title={t("state.restricted.title")}
          body={t("state.restricted.body")}
          action={
            <Link to={pathTo("S01")} className={buttonClass("primary")}>
              {t("plan.login")}
            </Link>
          }
        />
      ) : report.state === "offline" ? (
        <PageState
          state="offline"
          pageName={t("header.title")}
          title={t("state.offline.title")}
          body={
            <>
              {t("state.offline.body")} {t("state.offline.uncached")}
            </>
          }
          action={<Button onClick={report.retry}>{t("state.offline.retry")}</Button>}
        />
      ) : report.state === "empty" ? (
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={
            <Link className={buttonClass("primary")} to={pathTo("S04")}>
              {t("state.empty.action")}
            </Link>
          }
        />
      ) : (
        data !== undefined && (
          <>
            {report.stale && (
              <PageState
                state="offline"
                compact
                title={t("state.offline.title")}
                body={t("state.offline.body")}
                action={<Button onClick={report.retry}>{t("state.offline.retry")}</Button>}
              />
            )}
            <ReportView key={`${data.exam_name}-${data.view}`} data={data} offline={report.stale} />
          </>
        )
      )}
    </ContainerScope>
  );
}
