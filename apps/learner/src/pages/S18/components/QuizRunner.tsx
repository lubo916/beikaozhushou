// 做题主流程（S18-02、S18-03、S18-21）：打开时停在断点续做的那一题；作答 → 选把握度 → 提交 → 揭晓（随堂、限时逐题揭晓；
// 快刷答对自动下一题；测评态交卷后一起揭晓）。作答草稿、把握度、草稿纸、划掉的选项只在这次打开时记在页面里；交上去的以接口为准。
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { S18AnswerInput, S18CheckVerdict, S18QuizSession } from "@exam-prep/contract";
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
import { nextOpenIndex, shapeOf, useQuizActions } from "../data.ts";
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
  const { submit, check, finish } = useQuizActions();
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
  const [seconds, setSeconds] = useState(0);
  const shownAt = useRef(Date.now());
  const summaryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((value) => value + 1);
      setSeconds((value) => value + 1);
    }, MS_PER_SECOND);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    shownAt.current = Date.now();
    setSeconds(0);
    setStrikeMode(false);
  }, [current]);

  const item = session.items[Math.min(current, last)];
  if (item === undefined) return null;

  const shape = shapeOf(item);
  const revealed = item.status === "revealed";
  const mine = item.answer === undefined ? undefined : fromWireResponse(shape, item.answer.response);
  const response = revealed ? (mine ?? emptyResponse(shape)) : (drafts[item.id] ?? mine ?? emptyResponse(shape));
  const saved = item.answer?.confidence;
  const confidence = confidences[item.id] ?? (saved === undefined || saved === "off" ? null : saved);
  const flagged = flags[item.id] ?? item.flagged;
  const nextOpen = nextOpenIndex(session.items, current);
  const resumed = session.items.some((entry) => entry.status !== "unanswered");

  const goNext = () => {
    if (nextOpen !== null) setCurrent(nextOpen);
    else if (current < last) setCurrent(current + 1);
    else summaryRef.current?.focus();
  };

  const send = () => {
    if (submitBlocker(shape, response, confidence, session.confidence_enabled) !== null || session.other_device) return;
    onStarted();
    const data: S18AnswerInput = {
      item_id: item.id,
      question_id: item.question.id,
      question_version: item.question.version,
      response: toWireResponse(shape, response),
      confidence: session.confidence_enabled && confidence !== null ? confidence : "off",
      duration_ms: Math.max(0, Date.now() - shownAt.current),
      hint_level: 0,
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
        onError: () => toast(t("question.submit_failed")),
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
      {resumed && !session.finished && <p className="text-small text-ink-secondary">{t("question.resume", { n: session.resume_index + 1 })}</p>}
      {intro}
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
            />
            {revealed && <RevealPanel item={item} onCheck={confirm} checking={check.isPending} />}
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
      <Dialog
        open={handInOpen}
        onClose={() => setHandInOpen(false)}
        title={t("question.hand_in_title")}
        description={session.progress.unanswered > 0 ? t("question.hand_in_body", { n: session.progress.unanswered }) : t("question.hand_in_body_all")}
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
