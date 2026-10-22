import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { param } from "@exam-prep/params";
import { Banner, Button, Columns, ContainerScope, PageHeader, PageState, Skeleton, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { AbilitiesCard } from "./components/AbilitiesCard.tsx";
import { GoalsCard } from "./components/GoalsCard.tsx";
import { HistoryCard } from "./components/HistoryCard.tsx";
import { MilestonesCard } from "./components/MilestonesCard.tsx";
import { PackagesCard } from "./components/PackagesCard.tsx";
import { ProfileCard, Shortcuts } from "./components/ProfileCard.tsx";
import { useGrowthProfile } from "./data.ts";

function Frame({ children }: { children: ReactNode }) {
  return <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">{children}</ContainerScope>;
}

function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton title lines={2} block />
      <Skeleton lines={2} />
      <Columns main={<Skeleton title lines={4} block />} aside={<Skeleton title lines={4} block />} />
    </div>
  );
}

// S34 没有多视图。七态来自请求结果与接口数据，不读取 ?state= 分支。
// 下一站推荐（S34-07）属 P2，本轮不实现。
export default function Page() {
  const { t } = useTranslation("S34");
  const toast = useToast();
  const home = useGrowthProfile();
  const data = home.data;
  const header = (
    <PageHeader
      title={t("title")}
      description={t("description")}
      meta={
        data?.data_source === "sample" ? (
          <Tag size="sm" tone="warning">
            {t("sample")}
          </Tag>
        ) : undefined
      }
      actions={
        data === undefined || home.state === "empty" ? undefined : (
          // feat:S34-06 档案导出：真实通用格式接口待登记，离线时不可导出。
          <Button disabled={home.stale} onClick={() => toast(t("soon.export"))}>
            {t("profile.export")}
          </Button>
        )
      }
    />
  );

  if (home.state === "loading")
    return (
      <Frame>
        {header}
        <PageState
          state="loading"
          pageName={t("title")}
          skeleton={<Loading />}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        />
      </Frame>
    );
  if (home.state === "offline")
    return (
      <Frame>
        {header}
        <PageState
          state="offline"
          pageName={t("title")}
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={home.retry}>{t("state.offline.action")}</Button>}
        />
      </Frame>
    );
  if (home.state === "restricted")
    return (
      <Frame>
        {header}
        <PageState
          state="restricted"
          title={t("state.access_denied.title")}
          body={t("state.access_denied.body")}
          action={
            <Link to={pathTo("S35")} className={buttonClass("secondary")}>
              {t("shortcuts.page.S35")}
            </Link>
          }
        />
      </Frame>
    );
  if (home.state === "error" || data === undefined)
    return (
      <Frame>
        {header}
        <PageState state="error" pageName={t("title")} onRetry={home.retry} onReport={() => toast(t("soon.report"))} />
      </Frame>
    );

  return (
    <Frame>
      {header}
      {home.stale && (
        <Banner
          tone="warning"
          title={t("state.offline.cached")}
          action={
            <Button size="sm" onClick={home.retry}>
              {t("state.offline.action")}
            </Button>
          }
        >
          {t("state.offline.body")}
        </Banner>
      )}
      <ProfileCard data={data} />
      <Shortcuts data={data} />
      {data.restriction_not_applicable === true && (
        <PageState compact state="restricted" title={t("state.restricted.title")} body={t("state.restricted.body")} />
      )}
      {home.state === "empty" ? (
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={
            <Link to={pathTo("S06")} className={buttonClass("primary")}>
              {t("state.empty.action")}
            </Link>
          }
        />
      ) : (
        <Columns
          main={
            <div className="flex flex-col gap-4">
              <GoalsCard goals={data.goals} />
              <MilestonesCard items={data.milestones} />
              <AbilitiesCard items={data.abilities} comparison={data.comparison} />
            </div>
          }
          aside={
            <div className="flex flex-col gap-4">
              <PackagesCard items={data.packages} />
              <HistoryCard items={data.history} />
            </div>
          }
        />
      )}
    </Frame>
  );
}
