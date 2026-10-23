// S04 测评中（沉浸页，feat:S04-10）：外壳收起侧栏与顶栏，只留测评条（第几题、预计剩余、暂停并退出），侧栏不放学科内容。
// 测评态（feat:S04-04）：全程不显示对错，不出现导师（外壳按视图关掉）、搜题与提示（接口不给提示）。
// 桌面右侧放分模块进度（feat:S04-08），平板排在题目下面，手机收进“模块进度”抽屉；快速定位先按章自评（feat:S04-03）；交卷后显示摸底结果。
import { useTranslation } from "react-i18next";
import type { S04Session } from "@exam-prep/contract";
import { Banner, Button, COPY, Columns } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { FinishCard } from "../components/FinishCard.tsx";
import { ModuleCard, ModuleDrawer } from "../components/ModuleProgress.tsx";
import { QuestionPanel } from "../components/QuestionPanel.tsx";
import { RatingCard } from "../components/RatingCard.tsx";
import { TestBar } from "../components/TestBar.tsx";
import { useDiagnosisActions } from "../data.ts";

export interface TestViewProps {
  readonly session: S04Session;
  readonly stale: boolean;
  readonly onRetry: () => void;
  /** 暂停成功后：去掉开发用的 ?view=，视图跟着数据回到开始页。 */
  readonly onLeave: () => void;
}

export function TestView({ session, stale, onRetry, onLeave }: TestViewProps) {
  const { t } = useTranslation("S04");
  const toast = useToast();
  const actions = useDiagnosisActions();
  const failed = () => toast(t("action_failed"));
  // feat:S04-07 断点续做：暂停并退出，已答的题保留，回到开始页接着做
  const pause = () => actions.pause.mutate({ sessionId: session.id }, { onSuccess: onLeave, onError: failed });
  // feat:S04-09 测评中只留“改用快速定位”：已答的题保留，没测到的章改成按章自评
  const switchQuick = () => actions.switchQuick.mutate({ sessionId: session.id }, { onError: failed });
  const main =
    session.stage === "rating" && session.rating !== undefined ? (
      <RatingCard key={`${session.id}-rating`} sessionId={session.id} task={session.rating} />
    ) : session.current !== undefined ? (
      <QuestionPanel
        key={session.current.id}
        sessionId={session.id}
        item={session.current}
        onSwitchQuick={switchQuick}
        switching={actions.switchQuick.isPending}
      />
    ) : null;
  return (
    <>
      <TestBar session={session} onPause={pause} pausing={actions.pause.isPending} />
      {stale && (
        <Banner
          tone="warning"
          title={t("state.offline.stale")}
          action={
            <Button size="sm" onClick={onRetry}>
              {COPY.action.retry}
            </Button>
          }
        >
          {t("state.offline.body")}
        </Banner>
      )}
      {session.stage === "finished" ? (
        <FinishCard session={session} />
      ) : (
        <>
          <Columns
            main={main}
            aside={
              <div className="hidden @tablet:block">
                <ModuleCard modules={session.modules} />
              </div>
            }
          />
          <ModuleDrawer modules={session.modules} />
        </>
      )}
    </>
  );
}
