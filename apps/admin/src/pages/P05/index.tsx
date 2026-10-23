// P05 考情分析工作台（平台后台简版：主视图＋七态＋P0 功能点；暂缓的 P1 见 W03 交接单）。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { param } from "@exam-prep/params";
import { vocabLabel } from "@exam-prep/shared/vocab";
import { Banner, Button, Columns, ContainerScope, PageHeader, PageState, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { Link, useLocation } from "../../router/history.tsx";
import { pathTo } from "../../routes.ts";
import { AnalysisSkeleton } from "./components/AnalysisSkeleton.tsx";
import { MaturityCard } from "./components/MaturityCard.tsx";
import { ProfileCard } from "./components/ProfileCard.tsx";
import { QuestionTable } from "./components/QuestionTable.tsx";
import { SourceFilters } from "./components/SourceFilters.tsx";
import { WordingCard } from "./components/WordingCard.tsx";
import { useExamAnalysis, type SourceFilter } from "./data.ts";

export default function Page() {
  const { t } = useTranslation("P05");
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const toast = useToast();
  const [source, setSource] = useState<SourceFilter>("all");
  const analysis = useExamAnalysis({ exam: query.get("exam") ?? "kj", state: query.get("state") ?? "normal", source });
  const data = analysis.data;
  const soon = () => toast(t("soon"));
  const clearFilters = () => {
    setSource("all");
    analysis.retry();
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
                {t("maturityNow", { level: vocabLabel("data_maturity", data.maturity.level) })}
              </Tag>
            </span>
          )
        }
        actions={
          analysis.state === "restricted" ? undefined : (
            // feat:P05-01 真题入库（按三级来源标注）：入库要后端与权限，先提示“即将上线”。
            <Button variant="primary" onClick={soon}>
              {t("actions.import")}
            </Button>
          )
        }
      />
      {analysis.state !== "restricted" && <SourceFilters data={data} source={source} onSource={setSource} />}
      {analysis.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("title")}
          skeleton={<AnalysisSkeleton />}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        />
      ) : analysis.state === "offline" ? (
        <PageState
          state="offline"
          pageName={t("title")}
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={analysis.retry}>{t("state.offline.action")}</Button>}
        />
      ) : analysis.state === "restricted" ? (
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
      ) : analysis.state === "error" || data === undefined ? (
        <PageState
          state="error"
          pageName={t("title")}
          audience="staff"
          body={t("state.error.body")}
          onRetry={analysis.retry}
          onReport={soon}
        />
      ) : (
        <>
          {analysis.stale && <Banner tone="warning" title={t("state.offline.stale")} />}
          {analysis.state === "empty" ? (
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
            <Columns
              main={
                <div className="flex flex-col gap-4">
                  <QuestionTable data={data} onConfirm={soon} />
                  <ProfileCard data={data} />
                </div>
              }
              aside={
                <div className="flex flex-col gap-4">
                  <MaturityCard data={data} />
                  <WordingCard />
                </div>
              }
            />
          )}
        </>
      )}
    </ContainerScope>
  );
}
