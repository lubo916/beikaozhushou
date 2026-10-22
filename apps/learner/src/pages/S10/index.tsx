// S10 知识点主页（F08 样板页：后面的页面照着写，写法说明在 docs/baseline/ui-rules.md 第 13 节）。
// 页面只管显示：数据经 data.ts 里生成的钩子拿；七态由接口层制造，这里按请求结果选显示哪一态（?state= 不用页面写分支）。本页没有多视图。
// 原型：python3 tools/bk.py spec S10、python3 tools/bk.py proto S10 --views。布局：页头＋左右两栏（页面内容区 ≥ 860 时两栏，窄了上下排）。
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { param } from "@exam-prep/params";
import { Banner, Button, COPY, Columns, ContainerScope, PageState, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { DEMO_PARAM, pathTo } from "../../routes.ts";
import { CardsNotesCard } from "./components/CardsNotesCard.tsx";
import { EvidenceCard } from "./components/EvidenceCard.tsx";
import { ExamProfileCard } from "./components/ExamProfileCard.tsx";
import { HomeHeader } from "./components/HomeHeader.tsx";
import { HomeSkeleton } from "./components/HomeSkeleton.tsx";
import { LadderCard } from "./components/LadderCard.tsx";
import { MaterialsCard } from "./components/MaterialsCard.tsx";
import { MethodsCard } from "./components/MethodsCard.tsx";
import { MistakesCard } from "./components/MistakesCard.tsx";
import { QuestionsCard } from "./components/QuestionsCard.tsx";
import { RelationsCard } from "./components/RelationsCard.tsx";
import { useKnowledgePointHome } from "./data.ts";

/** 页面内容区：容器查询的作用域（里面的组件按这块区域的宽度切换布局）。 */
function Frame({ children }: { children: ReactNode }) {
  return <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">{children}</ContainerScope>;
}

export default function Page() {
  const { t } = useTranslation("S10");
  const { t: tc } = useTranslation();
  const toast = useToast();
  const { kpId = DEMO_PARAM } = useParams();
  const home = useKnowledgePointHome(kpId);
  const pageName = tc("page.S10");
  const data = home.data;

  if (home.state === "loading") {
    return (
      <Frame>
        <PageState state="loading" pageName={pageName} skeleton={<HomeSkeleton />} slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")} />
      </Frame>
    );
  }
  if (home.state === "offline") {
    return (
      <Frame>
        <PageState
          state="offline"
          pageName={pageName}
          body={t("state.offline.body")}
          action={
            <Link to={pathTo("S14")} className={buttonClass("secondary")}>
              {t("state.offline.notes")}
            </Link>
          }
        />
      </Frame>
    );
  }
  if (home.state === "restricted") {
    return (
      <Frame>
        <PageState
          state="restricted"
          pageName={pageName}
          title={t("state.restricted.title")}
          body={t("state.restricted.body")}
          action={
            <Link to={pathTo("S31")} className={buttonClass("secondary")}>
              {t("state.restricted.action")}
            </Link>
          }
        />
      </Frame>
    );
  }
  if (home.state === "error" || data === undefined) {
    return (
      <Frame>
        <PageState state="error" pageName={pageName} onRetry={home.retry} onReport={() => toast(t("soon.report"))} />
      </Frame>
    );
  }
  return (
    <Frame>
      {home.stale && (
        <Banner
          tone="warning"
          title={t("state.offline.stale")}
          action={
            <Button size="sm" onClick={home.retry}>
              {COPY.action.retry}
            </Button>
          }
        >
          {t("state.offline.body")}
        </Banner>
      )}
      <HomeHeader point={data.point} addToday={data.add_today} attackPack={data.attack_pack} sample={data.data_source === "sample"} />
      {home.state === "empty" ? (
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={
            <Link to={pathTo("S11")} className={buttonClass("primary")}>
              {t("state.empty.action")}
            </Link>
          }
        />
      ) : (
        <Columns
          main={
            <div className="flex flex-col gap-4">
              <LadderCard ladder={data.ladder} />
              <MethodsCard methods={data.methods} />
              <MistakesCard mistakes={data.mistakes} />
              <QuestionsCard questions={data.questions} />
              <EvidenceCard evidence={data.evidence} />
            </div>
          }
          aside={
            <div className="flex flex-col gap-4">
              <MaterialsCard materials={data.materials} />
              <ExamProfileCard profile={data.exam_profile} />
              <RelationsCard groups={data.relations} />
              <CardsNotesCard cards={data.cards} notes={data.notes} />
            </div>
          }
        />
      )}
    </Frame>
  );
}
