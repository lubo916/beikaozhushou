import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatSeconds } from "@exam-prep/shared/format";
import { param } from "@exam-prep/params";
import type { S21OralTrainingHome, S21Scenario } from "@exam-prep/contract";
import { Banner, Button, Card, Columns, ContainerScope, PageHeader, PageState, Skeleton, Tag } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { TrainingDialog } from "./components/TrainingDialog.tsx";
import { AssessmentCard, PrivacyCard, RadarCard, ReconstructionCard, TranscriptCard } from "./components/TrainingCards.tsx";
import { useOralTrainingHome } from "./data.ts";

function Frame({ children }: { children: ReactNode }) {
  return <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">{children}</ContainerScope>;
}

export default function Page() {
  const { t } = useTranslation("S21");
  const toast = useToast();
  const home = useOralTrainingHome();
  const pageName = t("title");

  if (home.state === "loading")
    return (
      <Frame>
        <PageState
          state="loading"
          pageName={pageName}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={
            <div className="flex flex-col gap-4">
              <Skeleton title lines={2} />
              <Skeleton block lines={4} />
              <Skeleton block lines={4} />
            </div>
          }
        />
      </Frame>
    );
  if (home.state === "offline")
    return (
      <Frame>
        <PageHeader title={pageName} />
        <PageState
          state="offline"
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={home.retry}>{t("state.offline.retry")}</Button>}
        />
      </Frame>
    );
  if (home.state === "restricted" && home.data === undefined)
    return (
      <Frame>
        <PageState
          state="restricted"
          title={t("privacy.restricted_title")}
          body={t("privacy.restricted_body")}
          action={<Button onClick={home.retry}>{t("privacy.restricted_action")}</Button>}
        />
      </Frame>
    );
  if (home.state === "error" || home.data === undefined)
    return (
      <Frame>
        <PageState state="error" pageName={pageName} onRetry={home.retry} onReport={() => toast(t("state.error.report"))} />
      </Frame>
    );
  return (
    <Frame>
      <TrainingHome key={home.data.exam_id} data={home.data} stale={home.stale} retry={home.retry} />
    </Frame>
  );
}

function TrainingHome({ data, stale, retry }: { data: S21OralTrainingHome; stale: boolean; retry: () => void }) {
  const { t } = useTranslation("S21");
  const toast = useToast();
  // feat:S21-01 画像给挂载结论；手动开关仅控制本次训练预览，不改目标配置或公共导航。
  const [enabled, setEnabled] = useState(data.activation !== "disabled");
  const [scenario, setScenario] = useState<S21Scenario>();
  const start = () => {
    if (!stale) setScenario(data.scenarios[0]);
  };
  const toggle = () => {
    setEnabled(!enabled);
    if (!enabled) toast(t("activation.local"));
  };
  const activeLabel = enabled ? (data.activation === "automatic" ? "auto" : "manual") : "disabled";

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="s21-home" data-view="main">
      {stale && (
        <Banner tone="warning" title={t("state.offline.stale")} action={<Button onClick={retry}>{t("state.offline.retry")}</Button>}>
          {t("state.offline.body")}
        </Banner>
      )}
      <PageHeader
        title={t("title")}
        description={t("description")}
        eyebrow={t("header.exam", { exam: data.exam_name })}
        actions={
          <>
            <Button size="sm" onClick={toggle}>
              {enabled ? t("activation.close") : t("activation.enable")}
            </Button>
            <Button variant="primary" onClick={start} disabled={!enabled || stale || data.scenarios.length === 0}>
              {t("header.start")}
            </Button>
          </>
        }
        meta={
          <>
            <Tag tone="brand">{t(`header.${activeLabel}`)}</Tag>
            <Tag tone="outline">{t("header.preview")}</Tag>
            {data.data_source === "sample" && <Tag tone="warning">{t("sample")}</Tag>}
          </>
        }
      />

      {enabled ? (
        <>
          {/* feat:S21-10 简版只展示下一站与计划提议入口，任何计划调整都等用户确认。 */}
          <Banner
            tone="info"
            title={t("next.title")}
            action={
              <Button size="sm" onClick={() => toast(t("soon.proposal"))}>
                {t("next.proposal")}
              </Button>
            }
          >
            <p>{data.next_stage}</p>
            <p className="text-small text-ink-secondary">{t("next.note")}</p>
          </Banner>
          {/* feat:S21-03 场景按接口中的考试画像配置显示；简版先查看流程。 */}
          <Card title={t("scenes.title")}>
            <div className="flex flex-wrap gap-3">
              {data.scenarios.map((item) => (
                <ScenarioCard key={item.id} scenario={item} disabled={stale} onOpen={() => setScenario(item)} />
              ))}
            </div>
          </Card>
          <ol aria-label={t("flow.steps")} className="flex overflow-hidden rounded-sm bg-brand-primary-soft text-small font-medium">
            {data.flow.map((step) => (
              <li key={step} className="min-w-0 flex-1 border-r border-bg-surface p-2">
                {step}
              </li>
            ))}
          </ol>
          {!data.assessment.available && (
            <PageState
              state="empty"
              title={t("state.empty.title")}
              body={t("state.empty.body")}
              action={
                <Button variant="primary" onClick={start} disabled={stale}>
                  {t("state.empty.action")}
                </Button>
              }
            />
          )}
          <Columns
            main={
              <div className="flex flex-col gap-4">
                {data.assessment.available && (
                  <>
                    <AssessmentCard data={data.assessment} onStart={start} disabled={stale} />
                    <TranscriptCard data={data.assessment} />
                  </>
                )}
              </div>
            }
            aside={
              <div className="flex flex-col gap-4">
                {data.assessment.available && <ReconstructionCard data={data.assessment} onStart={start} disabled={stale} />}
                <RadarCard data={data.radar} />
                <PrivacyCard allowed={data.video_analysis_allowed} onSettings={start} disabled={stale} />
              </div>
            }
          />
        </>
      ) : (
        <Columns
          main={
            <PageState
              state="empty"
              title={t("activation.disabled_title")}
              body={t("activation.disabled_body")}
              action={
                <Button variant="primary" onClick={toggle}>
                  {t("activation.enable")}
                </Button>
              }
            />
          }
          aside={
            <PrivacyCard
              allowed={data.video_analysis_allowed}
              onSettings={() => {
                setEnabled(true);
                start();
              }}
              disabled={stale}
            />
          }
        />
      )}
      {scenario !== undefined && (
        <TrainingDialog
          scenario={scenario}
          flow={data.flow}
          videoAllowed={data.video_analysis_allowed}
          onClose={() => setScenario(undefined)}
        />
      )}
    </div>
  );
}

function ScenarioCard({ scenario, disabled, onOpen }: { scenario: S21Scenario; disabled: boolean; onOpen: () => void }) {
  const { t } = useTranslation("S21");
  return (
    <div className="flex min-w-0 flex-1 basis-full @tablet:basis-1/4 flex-col items-start gap-2 rounded-sm border border-line-soft bg-bg-sunk p-4">
      <h3 className="font-medium">{scenario.title}</h3>
      <p className="text-small text-ink-secondary">{scenario.description}</p>
      <ScenarioDuration seconds={scenario.duration_seconds} />
      <Button size="sm" disabled={disabled} onClick={onOpen} aria-label={`${scenario.title} · ${t("scenes.start")}`}>
        {t("scenes.start")}
      </Button>
    </div>
  );
}

function ScenarioDuration({ seconds }: { seconds: number }) {
  const { t } = useTranslation("S21");
  return <p className="text-small text-ink-tertiary">{t("scenes.duration", { duration: formatSeconds(seconds) })}</p>;
}
