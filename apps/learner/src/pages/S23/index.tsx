import "./report.css";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { param } from "@exam-prep/params";
import { formatCount, formatDateTime } from "@exam-prep/shared/format";
import { Button, Card, Columns, ContainerScope, PageHeader, PageState, Skeleton, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { DEMO_PARAM, pathTo } from "../../routes.ts";
import { DistributionCard, type ReviewFilter } from "./components/DistributionCard.tsx";
import { AnalysisCard, ConfidenceCard, ReinforcementCard, SimulationCard, TimingCard } from "./components/ReportCards.tsx";
import { ReportHero } from "./components/ReportHero.tsx";
import { ReviewDialog } from "./components/ReviewDialog.tsx";
import { useAssessmentReport } from "./data.ts";

export default function Page() {
  const { t } = useTranslation("S23");
  const toast = useToast();
  const { reportId = DEMO_PARAM } = useParams();
  const report = useAssessmentReport(reportId);
  const [filter, setFilter] = useState<ReviewFilter>();
  const data = report.data;
  // 页面登记只有主视图；?view= 不额外制造未登记的视图。七态仅根据数据层的请求结果显示。
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("page")}
        eyebrow={t("header.eyebrow")}
        description={
          data?.available
            ? t("header.date", { date: formatDateTime(data.completed_at, data.time_zone, { year: true }) })
            : t("header.subtitle")
        }
        actions={
          <>
            <Link className={buttonClass("secondary")} to={pathTo("S22")}>
              {t("header.back")}
            </Link>
            {data?.available && <Button onClick={() => setFilter({ name: t("review.all") })}>{t("header.review")}</Button>}
          </>
        }
        meta={data?.data_source === "sample" && <Tag tone="warning">{t("sample")}</Tag>}
      />
      {report.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("page")}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={
            <div className="flex flex-col gap-4">
              <Skeleton title lines={3} block />
              <Columns main={<Skeleton title lines={5} block />} aside={<Skeleton title lines={4} block />} />
            </div>
          }
        />
      ) : report.state === "empty" ? (
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={
            <Link className={buttonClass("primary")} to={pathTo("S22")}>
              {t("state.empty.action")}
            </Link>
          }
        />
      ) : report.state === "error" ? (
        <PageState
          state="error"
          pageName={t("page")}
          body={t("state.error.body")}
          onRetry={report.retry}
          onReport={() => toast(t("soon"))}
        />
      ) : (
        <>
          {report.state === "offline" && (
            <PageState
              compact
              state="offline"
              title={t("state.offline.title")}
              body={t("state.offline.body")}
              action={!data ? <Button onClick={report.retry}>{t("state.empty.action")}</Button> : undefined}
            />
          )}
          {report.state === "offline" && !data && <p className="text-small text-ink-secondary">{t("state.offline.missing")}</p>}
          {(report.state === "restricted" || (data && data.pending_grading > 0)) && (
            <PageState
              compact
              state="restricted"
              title={t("state.restricted.title")}
              body={t("state.restricted.body", { quantity: formatCount(data?.pending_grading ?? 0) })}
              action={
                <Button
                  onClick={() =>
                    data
                      ? setFilter({ name: t("review.pending"), ids: data.questions.filter((q) => q.pending_grading).map((q) => q.id) })
                      : toast(t("soon"))
                  }
                >
                  {t("state.restricted.action")}
                </Button>
              }
            />
          )}
          {data?.available && (
            <>
              <ReportHero report={data} />
              <Columns
                main={
                  <div className="flex flex-col gap-4">
                    {/* feat:S23-02 六类失分归因；feat:S23-03 图例筛选对应题目。 */}
                    <DistributionCard title={t("loss.title")} groups={data.losses} onSelect={setFilter} hint={t("loss.hint")} />
                    <AnalysisCard title={t("analysis.types")} rows={data.question_types} />
                    <TimingCard report={data} />
                    <ReinforcementCard report={data} />
                    {/* feat:S23-07 一键重做本场错题：待正式会话接口接通，先提示即将上线。 */}
                    <Button onClick={() => toast(t("soon"))}>{t("header.redo")}</Button>
                  </div>
                }
                aside={
                  <div className="flex flex-col gap-4">
                    <AnalysisCard title={t("analysis.points")} rows={data.knowledge_points} points />
                    <ConfidenceCard report={data} />
                    <SimulationCard report={data} />
                    <DistributionCard title={t("loss.causes")} groups={data.error_causes} onSelect={setFilter} />
                    <DistributionCard title={t("loss.traps")} groups={data.traps} onSelect={setFilter} />
                    <Card title={t("loss.attribution")}>
                      <p className="mb-3">{t("loss.unattributed", { quantity: formatCount(data.unattributed_count) })}</p>
                      <Button onClick={() => setFilter({ name: t("review.unattributed"), ids: data.unattributed_question_ids })}>
                        {t("loss.attribute")}
                      </Button>
                    </Card>
                  </div>
                }
              />
              <ReviewDialog report={data} filter={filter} onClose={() => setFilter(undefined)} />
            </>
          )}
        </>
      )}
    </ContainerScope>
  );
}
