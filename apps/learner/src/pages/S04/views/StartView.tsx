// S04 开始页（引导页，feat:S04-09）：第一题之前讲清三种方式各自的代价、题源、预计时长与规则。
// 页头下面按数据放：离线提示、再次诊断说明（feat:S04-12）、上次没做完（feat:S04-07）、补充诊断（feat:S04-14）、交卷后的摸底结果、数据不足提示。
// 题源不足时是空态：页头照常，下面只有说明和“改用快速定位”（feat:S04-06，规则卡 R3；F08-Q2）。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S04Diagnosis, S04Mode } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared/format";
import { Banner, Button, COPY, Card, PageState, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";
import { DiagnosisHeader } from "../components/DiagnosisHeader.tsx";
import { FinishCard } from "../components/FinishCard.tsx";
import { ModeCards } from "../components/ModeCards.tsx";
import { RulesCard } from "../components/RulesCard.tsx";
import { SourceCard } from "../components/SourceCard.tsx";
import { useDiagnosisActions } from "../data.ts";

export interface StartViewProps {
  readonly data: S04Diagnosis;
  /** 题源不足、还没有会话（data.ts 的判断）。 */
  readonly empty: boolean;
  readonly stale: boolean;
  readonly onRetry: () => void;
  /** 开始、接着做成功后：去掉开发用的 ?view=，视图跟着数据走。 */
  readonly onLeave: () => void;
}

export function StartView({ data, empty, stale, onRetry, onLeave }: StartViewProps) {
  const { t } = useTranslation("S04");
  const toast = useToast();
  const actions = useDiagnosisActions();
  const preset = data.modes.find((option) => option.available && option.selected)?.mode ?? data.modes.find((option) => option.available)?.mode;
  const [chosen, setChosen] = useState<S04Mode | undefined>(undefined);
  const mode = chosen ?? preset;
  const session = data.session;
  const open = session !== undefined && session.stage !== "finished" ? session : undefined;
  const done = session !== undefined && session.stage === "finished" ? session : undefined;
  const busy = actions.start.isPending || actions.resume.isPending;
  const failed = () => toast(t("action_failed"));
  const begin = (next: S04Mode) => actions.start.mutate({ data: { mode: next } }, { onSuccess: onLeave, onError: failed });
  const resume = (sessionId: string) => actions.resume.mutate({ sessionId }, { onSuccess: onLeave, onError: failed });
  const prior = data.prior_modules > 0;
  const thin = prior || data.no_basis_modules > 0;
  const counts = [
    ...(prior ? [{ key: "prior", label: t("state.insufficient.prior_count"), value: formatCount(data.prior_modules) }] : []),
    ...(data.no_basis_modules > 0
      ? [{ key: "no_basis", label: t("state.insufficient.no_basis_count"), value: formatCount(data.no_basis_modules) }]
      : []),
  ];

  return (
    <>
      <DiagnosisHeader sample={data.data_source === "sample"} />
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
      {/* feat:S04-12 可重复且只升不降：再次诊断只更新测到的知识点，结果低于现有证据时不降级 */}
      {data.retake && (
        <Banner tone="info" title={t("retake.title")}>
          {t("retake.body")}
        </Banner>
      )}
      {/* feat:S04-07 断点续做：上次没做完的，已答的题保留，接着做 */}
      {open !== undefined && (
        <Banner
          tone="info"
          title={t("resume.title")}
          action={
            <Button size="sm" variant="primary" busy={actions.resume.isPending} onClick={() => resume(open.id)}>
              {t("resume.action")}
            </Button>
          }
        >
          {t("resume.body", { n: open.answered })}
        </Banner>
      )}
      {/* feat:S04-14 补充诊断：长时间中断后，可以先做一次简短的补充诊断 */}
      {data.refresh !== undefined && open === undefined && (
        <Banner
          tone="info"
          title={t("refresh.title")}
          action={
            <Button size="sm" busy={actions.start.isPending} onClick={() => begin("refresh")}>
              {t("refresh.action")}
            </Button>
          }
        >
          {t("refresh.body", { items: data.refresh.items, minutes: data.refresh.minutes })}
        </Banner>
      )}
      {done !== undefined && <FinishCard session={done} />}
      {empty ? (
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body", { n: data.min_pool_items })}
          action={
            <Button variant="primary" busy={busy} onClick={() => begin("quick")}>
              {t("state.empty.action")}
            </Button>
          }
        />
      ) : (
        <>
          <ModeCards modes={data.modes} value={mode} onChange={setChosen} />
          {/* feat:S04-08 未测模块用群体先验并标注：有模块要用同类数据代替（或无依据）时先说清楚 */}
          {thin && (
            <Card>
              <PageState
                state="insufficient_data"
                compact
                title={prior ? t("state.insufficient.title") : t("state.insufficient.no_basis_title")}
                body={prior ? t("state.insufficient.body") : t("state.insufficient.no_basis")}
                counts={counts}
              />
            </Card>
          )}
          <div className="grid gap-4 @tablet:grid-cols-2">
            <SourceCard minPool={data.min_pool_items} />
            <RulesCard restricted={data.assessment_restricted} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to={pathTo("S03")} className={buttonClass("secondary")}>
              {t("action.prev")}
            </Link>
            {open !== undefined ? (
              <Button variant="primary" busy={busy} onClick={() => resume(open.id)}>
                {t("resume.action")}
              </Button>
            ) : (
              <Button
                variant="primary"
                busy={busy}
                disabled={mode === undefined}
                onClick={() => {
                  if (mode !== undefined) begin(mode);
                }}
              >
                {done !== undefined ? t("action.again") : t("action.start")}
              </Button>
            )}
          </div>
        </>
      )}
    </>
  );
}
