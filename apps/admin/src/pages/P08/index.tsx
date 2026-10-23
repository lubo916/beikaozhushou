// P08 题库审核与质量（平台后台简版：主视图＋七态＋P0 功能点；暂缓的 P1 见 W04 交接单）。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { param } from "@exam-prep/params";
import { formatDateTime } from "@exam-prep/shared";
import { Banner, Button, ContainerScope, PageHeader, PageState, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { Link, useLocation } from "../../router/history.tsx";
import { pathTo } from "../../routes.ts";
import { QuestionReviewContent } from "./components/QuestionReviewContent.tsx";
import { QuestionReviewSkeleton } from "./components/QuestionReviewSkeleton.tsx";
import { useQuestionReview, type OriginFilter } from "./data.ts";

export default function Page() {
  const { t } = useTranslation("P08");
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const toast = useToast();
  const [origin, setOrigin] = useState<OriginFilter>("all");
  const review = useQuestionReview({ exam: query.get("exam") ?? "kj", state: query.get("state") ?? "normal", origin });
  const data = review.data;
  const soon = () => toast(t("soon"));
  const resetFilters = () => {
    setOrigin("all");
    review.retry();
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
      {review.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("title")}
          skeleton={<QuestionReviewSkeleton />}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        />
      ) : review.state === "offline" ? (
        <PageState
          state="offline"
          pageName={t("title")}
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={review.retry}>{t("state.offline.action")}</Button>}
        />
      ) : review.state === "restricted" ? (
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
      ) : review.state === "error" || data === undefined ? (
        <PageState
          state="error"
          pageName={t("title")}
          audience="staff"
          body={t("state.error.body")}
          onRetry={review.retry}
          onReport={soon}
        />
      ) : review.state === "empty" ? (
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
          {review.stale && <Banner tone="warning" title={t("state.offline.stale")} />}
          <QuestionReviewContent data={data} origin={origin} onOrigin={setOrigin} onSoon={soon} />
        </>
      )}
    </ContainerScope>
  );
}
