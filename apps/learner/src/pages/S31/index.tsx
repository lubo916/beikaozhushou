import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { param } from "@exam-prep/params";
import { Banner, Button, Card, Columns, ContainerScope, PageHeader, PageState, Skeleton, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { useMembership } from "./data.ts";
import { CurrentCard } from "./components/CurrentCard.tsx";
import { ComparisonCard, RedemptionCard, ReminderCard, UsageCard } from "./components/BenefitsCards.tsx";
import { PurchaseCard } from "./components/PurchaseCard.tsx";
import { OrdersCard, PaymentCard } from "./components/OrdersCard.tsx";

/** S31 无登记的多视图。所有业务字段来自生成的接口钩子，查询参数状态由 MSW 生成。 */
export default function Page() {
  const { t } = useTranslation("S31");
  const toast = useToast();
  const home = useMembership();
  const data = home.data;
  const title = t("title");
  const header = (
    <PageHeader
      title={title}
      description={t("description")}
      meta={
        <Tag tone="warning" size="sm">
          {t("sample")}
        </Tag>
      }
    />
  );
  if (home.state === "loading")
    return (
      <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
        {header}
        <PageState
          state="loading"
          pageName={title}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={
            <Columns
              main={
                <>
                  <Skeleton title block />
                  <Skeleton title block />
                  <Skeleton title block />
                </>
              }
              aside={
                <>
                  <Skeleton title block />
                  <Skeleton title block />
                </>
              }
            />
          }
        />
      </ContainerScope>
    );
  if (home.state === "offline" && data === undefined)
    return (
      <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
        {header}
        <PageState
          state="offline"
          pageName={title}
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={home.retry}>{t("state.offline.action")}</Button>}
        />
        <Card title={t("core.title")}>
          <p>{t("core.body")}</p>
          <p className="mt-3 text-small text-ink-secondary">{t("current.retained")}</p>
        </Card>
      </ContainerScope>
    );
  if (home.state === "restricted" && data === undefined)
    return (
      <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
        {header}
        <PageState
          state="restricted"
          pageName={title}
          title={t("state.restricted.title")}
          body={t("state.restricted.body")}
          action={
            <Link to={pathTo("S35")} className={buttonClass("secondary")}>
              {t("state.restricted.action")}
            </Link>
          }
        />
      </ContainerScope>
    );
  if (home.state === "error" || data === undefined)
    return (
      <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
        {header}
        <PageState
          state="error"
          pageName={title}
          title={t("state.error.title")}
          body={t("state.error.body")}
          onRetry={home.retry}
          onReport={() => toast(t("soon"))}
        />
      </ContainerScope>
    );
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={title}
        description={t("description")}
        eyebrow={t("exam", { exam: data.exam_name })}
        meta={
          data.data_source === "sample" ? (
            <Tag tone="warning" size="sm">
              {t("sample")}
            </Tag>
          ) : undefined
        }
      />
      {home.stale && (
        <PageState
          state="offline"
          compact
          pageName={title}
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={home.retry}>{t("state.offline.action")}</Button>}
        />
      )}
      {/* feat:S31-02 核心学习闭环在所有档位不限量，额度用尽不影响学习。 */}
      <Banner tone="success" title={t("core.title")}>
        {t("core.body")}
      </Banner>
      {home.state === "empty" && (
        <PageState
          state="empty"
          pageName={title}
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={
            <a href="#membership-comparison" className={buttonClass("secondary")}>
              {t("state.empty.action")}
            </a>
          }
        />
      )}
      <Columns
        main={
          <>
            <CurrentCard data={data} offline={home.stale} />
            <UsageCard data={data} offline={home.stale} />
            <ComparisonCard data={data} />
            <PurchaseCard data={data} offline={home.stale} />
          </>
        }
        aside={
          <>
            <ReminderCard data={data} />
            <OrdersCard data={data} offline={home.stale} />
            <PaymentCard data={data} offline={home.stale} />
            <RedemptionCard data={data} offline={home.stale} />
            <Card title={t("promise.title")}>
              <p className="text-small text-ink-secondary">{t("promise.body")}</p>
            </Card>
          </>
        }
      />
    </ContainerScope>
  );
}
