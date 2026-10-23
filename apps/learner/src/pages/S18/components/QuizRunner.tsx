// 做题主流程（S18-02、S18-03、S18-21）：打开时停在断点续做的那一题；作答 → 选把握度 → 提交 → 揭晓（随堂、限时逐题揭晓；
// 快刷答对自动下一题；测评态交卷后一起揭晓）。作答草稿、把握度、草稿纸、划掉的选项只在这次打开时记在页面里；交上去的以接口为准。
// U18b：提示阶梯、错因确认经接口记下（成功后按 x-invalidates 刷新本组）；揭晓放进题目卡里（原型）；讲解与追问、引导我想在页面里开面板（U18b-Q1＝A）。
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { S18AnswerInput, S18CheckVerdict, S18ErrorCause, S18ExplainMode, S18QuizSession } from "@exam-prep/contract";
import { Button, Columns, Dialog } from "@exam-prep/ui";
import {
  emptyResponse,
  fromWireResponse,
  submitBlocker,
  toWireResponse,
  type QuizConfidence,
  type QuizResponse,
} from "../../../../../../packages/ui/src/quiz/index.ts";
import { useToast } from "../../../app/toast.tsx";
import { useNarrow } from "../../../app/useNarrow.ts";
import { nextOpenIndex, shapeOf, useQuizActions } from "../data.ts";
import { useQuestionTiming } from "../timing.ts";
import { ExplainPanel } from "./ExplainPanel.tsx";
import { ProgressCard } from "./ProgressCard.tsx";
import { QuestionCard } from "./QuestionCard.tsx";
import { RevealPanel } from "./RevealPanel.tsx";
import { SessionBar } from "./SessionBar.tsx";
import { SessionHeader } from "./SessionHeader.tsx";
import { SummaryCard } from "./SummaryCard.tsx";

const MS_PER_SECOND = 1000;

export interface ViewProps {
  readonly session: S18QuizSession;
  /** 取数与提交用的题组 ID（开发时 demo 已换成示范题组）。 */
  readonly sessionId: string;
  /** 这次打开后交过题。 */
  readonly onStarted: () => void;
}

export interface QuizRunnerProps extends ViewProps {
  /** 右栏本组进度下面的规则说明（两个视图不同）。 */
  readonly rule: string;
  /** 题目上方的视图说明（生成题视图有）。 */
  readonly intro?: ReactNode;
}

type Store<T> = Readonly<Record<string, T>>;

export function QuizRunner({ session, sessionId, onStarted, rule, intro }: QuizRunnerProps) {
  const { t } = useTranslation("S18");
  const toast = useToast();
  const { submit, check, finish, hint, cause } = useQuizActions();
  const last = Math.max(0, session.items.length - 1);
  // feat:S18-21 断点续做：从接口给的那一题接着做
  const [current, setCurrent] = useState(() => Math.min(session.resume_index, last));
  const [drafts, setDrafts] = useState<Store<QuizResponse>>({});
  const [confidences, setConfidences] = useState<Store<QuizConfidence>>({});
  const [scratch, setScratch] = useState<Store<string>>({});
  const [struck, setStruck] = useState<Store<readonly number[]>>({});
  const [flags, setFlags] = useState<Store<boolean>>({});
  const [strikeMode, setStrikeMode] = useState(false);
  const [handInOpen, setHandInOpen] = useState(false);
  const [elapsed, setElapsed] = useState(session.time.elapsed_seconds);
  // 断点续做的提示只说打开时停在哪一题；这次打开后交过题就不再显示（不随接口给的下一题变）
  const [opening] = useState(() => ({
    index: Math.min(session.resume_index, last),
    resumed: session.items.some((entry) => entry.status !== "unanswered"),
  }));
  const [answeredHere, setAnsweredHere] = useState(false);
  // 刚点的错因（还在记或刚记下）：先按它显示，记不上再退回接口给的
  const [causePicks, setCausePicks] = useState<Store<S18ErrorCause>>({});
  const [explain, setExplain] = useState<{ readonly itemId: string; readonly mode: S18ExplainMode } | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const narrow = useNarrow(frameRef);
  const item = session.items[Math.min(current, last)];
  const { seconds, refresh, pauseForSubmit, resumeAfterFailure } = useQuestionTiming(
    item === undefined ? undefined : `${sessionId}:${item.id}`,
    item?.answer?.duration_ms,
    !session.finished && item?.status === "unanswered",
  );
  const summaryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((value) => value + 1);
      refresh();
    }, MS_PER_SECOND);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    setStrikeMode(false);
  }, [current]);

  if (item === undefined) return null;

  const shape = shapeOf(item);
  const revealed = item.status === "revealed";
  const mine = item.answer === undefined ? undefined : fromWireResponse(shape, item.answer.response);
  const response = revealed ? (mine ?? emptyResponse(shape)) : (drafts[item.id] ?? mine ?? emptyResponse(shape));
  const saved = item.answer?.confidence;
  const confidence = confidences[item.id] ?? (saved === undefined || saved === "off" ? null : saved);
  const flagged = flags[item.id] ?? item.flagged;
  const nextOpen = nextOpenIndex(session.items, current, session.finished);

  const goNext = () => {
    if (nextOpen !== null) setCurrent(nextOpen);
    else if (current < last) setCurrent(current + 1);
    else summaryRef.current?.focus();
  };

  const send = () => {
    if (
      item.status === "revealed" ||
      session.finished ||
      submit.isPending ||
      finish.isPending ||
      submitBlocker(shape, response, confidence, session.confidence_enabled) !== null ||
      session.other_device
    )
      return;
    onStarted();
    setAnsweredHere(true);
    const data: S18AnswerInput = {
      item_id: item.id,
      question_id: item.question.id,
      question_version: item.question.version,
      response: toWireResponse(shape, response),
      confidence: session.confidence_enabled && confidence !== null ? confidence : "off",
      duration_ms: pauseForSubmit(),
      hint_level: item.hints.shown.length,
    };
    submit.mutate(
      { sessionId, data },
      {
        // feat:S18-02 快刷：答对自动下一题
        onSuccess: (next) => {
          if (session.mode === "quick" && next.result?.correct === true && nextOpen !== null) {
            toast(t("question.quick_next"));
            setCurrent(nextOpen);
          }
        },
        onError: () => {
          resumeAfterFailure();
          toast(t("question.submit_failed"));
        },
      },
    );
  };

  const confirm = (verdict: S18CheckVerdict) =>
    check.mutate(
      { sessionId, data: { item_id: item.id, verdict } },
      {
        onSuccess: (next) => {
          if (next.check === "problem") toast(t("reveal.check_done_problem"));
        },
        onError: () => toast(t("soon.check_failed")),
      },
    );

  // feat:S18-16 提示阶梯：要下一级提示（测评态不能看提示；交了就不再给）
  const takeHint = () => {
    if (hint.isPending || item.status !== "unanswered" || session.finished || session.restrictions.hints_locked) return;
    hint.mutate({ sessionId, data: { item_id: item.id } }, { onError: () => toast(t("question.hint_failed")) });
  };

  // feat:S18-08 错因确认：选了就记下，可以改选；记不上退回原来的并提示
  const chooseCause = (value: S18ErrorCause) => {
    const id = item.id;
    setCausePicks((all) => ({ ...all, [id]: value }));
    cause.mutate(
      { sessionId, data: { item_id: id, cause: value } },
      {
        onError: () => {
          setCausePicks((all) => Object.fromEntries(Object.entries(all).filter(([key]) => key !== id)));
          toast(t("reveal.cause_failed"));
        },
      },
    );
  };

  const explainItem = explain === null ? undefined : session.items.find((entry) => entry.id === explain.itemId);

  const handIn = () =>
    finish.mutate(
      { sessionId },
      {
        onSuccess: () => setHandInOpen(false),
        onError: () => toast(t("question.submit_failed")),
      },
    );

  const after =
    nextOpen === null && current === last ? (
      <Button variant="primary" onClick={() => summaryRef.current?.focus()}>
        {t("question.to_summary")}
      </Button>
    ) : (
      <Button variant="primary" onClick={goNext}>
        {t("question.next")}
      </Button>
    );

  return (
    <>
      <SessionBar session={session} current={current} onSelect={setCurrent} elapsed={elapsed} flags={flags} />
      <SessionHeader session={session} />
      {opening.resumed && !answeredHere && !session.finished && (
        <p className="text-small text-ink-secondary">{t("question.resume", { n: opening.index + 1 })}</p>
      )}
      {intro}
      <div ref={frameRef}>
        <Columns
          main={
            <div className="flex flex-col gap-4">
              <QuestionCard
                session={session}
                item={item}
                response={response}
                onResponse={(value) => setDrafts((all) => ({ ...all, [item.id]: value }))}
                confidence={confidence}
                onConfidence={(value) => setConfidences((all) => ({ ...all, [item.id]: value }))}
                scratch={scratch[item.id] ?? ""}
                onScratch={(text) => setScratch((all) => ({ ...all, [item.id]: text }))}
                struck={struck[item.id] ?? []}
                onStrike={(index) =>
                  setStruck((all) => {
                    const list = all[item.id] ?? [];
                    return { ...all, [item.id]: list.includes(index) ? list.filter((value) => value !== index) : [...list, index] };
                  })
                }
                strikeMode={strikeMode}
                onStrikeMode={setStrikeMode}
                flagged={flagged}
                onFlag={() => setFlags((all) => ({ ...all, [item.id]: !flagged }))}
                seconds={seconds}
                busy={submit.isPending}
                onSubmit={send}
                after={after}
                onHint={takeHint}
                hinting={hint.isPending}
                reveal={
                  revealed ? (
                    <RevealPanel
                      key={item.id}
                      item={item}
                      onCheck={confirm}
                      checking={check.isPending}
                      cause={causePicks[item.id] ?? item.result?.error_cause ?? null}
                      onCause={chooseCause}
                      onExplain={(mode) => setExplain({ itemId: item.id, mode })}
                    />
                  ) : undefined
                }
              />
            </div>
          }
          aside={
            <div className="flex flex-col gap-4">
              <ProgressCard session={session} current={current} rule={rule} onHandIn={() => setHandInOpen(true)} />
              <div ref={summaryRef} tabIndex={-1} className="rounded-md focus:outline-2 focus:outline-brand-primary">
                <SummaryCard session={session} />
              </div>
            </div>
          }
        />
      </div>
      {explain !== null && explainItem !== undefined && (
        <ExplainPanel
          key={`${explain.itemId}:${explain.mode}`}
          onClose={() => setExplain(null)}
          mode={explain.mode}
          sessionId={sessionId}
          item={explainItem}
          scratch={scratch[explainItem.id] ?? ""}
          narrow={narrow}
        />
      )}
      <Dialog
        open={handInOpen}
        onClose={() => setHandInOpen(false)}
        title={t("question.hand_in_title")}
        description={
          session.progress.unanswered > 0 ? t("question.hand_in_body", { n: session.progress.unanswered }) : t("question.hand_in_body_all")
        }
        actions={
          <>
            <Button onClick={() => setHandInOpen(false)}>{t("question.hand_in_cancel")}</Button>
            <Button variant="primary" busy={finish.isPending} onClick={handIn}>
              {t("question.hand_in_confirm")}
            </Button>
          </>
        }
      />
    </>
  );
}
