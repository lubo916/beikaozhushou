// 讲解与追问（S18-13）与引导我想（S18-17）：在做题页里开面板（U18b-Q1＝A），自动带上题目、所选项、把握度与草稿
// （题目与作答由接口按这一题取，草稿只在页面里、由这里带上）。导师的回复是 AI 生成，一律用 AiContent 带显式标识（红线 4）；
// 导师不可用时照常回来，只说明讲解先暂停、解析照常看，不报错（ui-rules 第 7 节）。对话只留在这次打开的面板里，要长聊去导师页（路由表 S28）。
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S18ExplainMode, S18QuizItem } from "@exam-prep/contract";
import { vocabLabel } from "@exam-prep/shared/vocab";
import { AiContent, Banner, Button, COPY, Sheet, Skeleton, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";
import { LETTERS, useQuizTutor } from "../data.ts";

export interface ExplainPanelProps {
  readonly onClose: () => void;
  readonly mode: S18ExplainMode;
  readonly sessionId: string;
  readonly item: S18QuizItem;
  /** 草稿纸上的内容（讲解时一起带上）。 */
  readonly scratch: string;
  /** 手机布局：面板从底部出来。 */
  readonly narrow: boolean;
}

interface Turn {
  readonly id: number;
  readonly from: "me" | "tutor";
  readonly lines: readonly string[];
  readonly wrongStep?: number | undefined;
}

export function ExplainPanel({ onClose, mode, sessionId, item, scratch, narrow }: ExplainPanelProps) {
  const { t } = useTranslation("S18");
  // 第一次讲解在面板打开时就发：用 mutateAsync 等结果（开发模式的严格模式会重挂一次，mutate 的回调会丢，等 Promise 不会）
  const { mutateAsync } = useQuizTutor();
  const [pending, setPending] = useState(false);
  const carriedId = useId();
  const inputId = useId();
  const counter = useRef(0);
  const started = useRef(false);
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const [thread, setThread] = useState<string | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<readonly string[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  /** 没取到回复的那一次（空字符串表示第一次讲解）。 */
  const [failed, setFailed] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const addTurn = useCallback((turn: Omit<Turn, "id">) => {
    counter.current += 1;
    const id = counter.current;
    setTurns((all) => [...all, { ...turn, id }]);
  }, []);

  const request = useCallback(
    (followUp: string) => {
      setFailed(null);
      setPending(true);
      void mutateAsync({
        sessionId,
        data: {
          item_id: item.id,
          mode,
          scratch,
          ...(followUp === "" ? {} : { follow_up: followUp }),
          ...(thread === undefined ? {} : { thread_id: thread }),
        },
      })
        .then((reply) => {
          setThread(reply.thread_id);
          if (!reply.tutor_available) {
            setUnavailable(true);
            return;
          }
          addTurn({ from: "tutor", lines: reply.reply.split("\n"), wrongStep: reply.wrong_step });
          setSuggestions(reply.follow_ups);
        })
        .catch(() => setFailed(followUp))
        .finally(() => setPending(false));
    },
    [mutateAsync, sessionId, item.id, mode, scratch, thread, addTurn],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    request("");
  }, [request]);

  const follow = (text: string) => {
    const said = text.trim();
    if (said === "" || pending || unavailable) return;
    addTurn({ from: "me", lines: [said] });
    setDraft("");
    setSuggestions([]);
    request(said);
  };

  // feat:S18-13 自动带上题目、所选项、把握度与草稿
  const response = item.answer?.response;
  const options = item.question.options ?? [];
  const picked = response?.selected ?? [];
  const written = (response?.text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const answerText =
    picked.length > 0
      ? picked
          .map((index) =>
            options.length > 0
              ? t("explain.answer_option", { letter: LETTERS.charAt(index), text: options[index] ?? "" })
              : t("explain.answer_text", { text: item.parts?.[index] ?? "" }),
          )
          .join(t("explain.answer_join"))
      : written.length > 0
        ? t("explain.answer_text", { text: written.join(t("explain.answer_text_join")) })
        : t("explain.carried_none");
  const saved = item.answer?.confidence;
  const confidence = saved === undefined || saved === "off" ? t("explain.confidence_off") : vocabLabel("confidence", saved);
  const carried = [
    t("explain.carried_question", { n: item.index + 1, type: item.question.label ?? t(`question.qtype.${item.question.question_type}`) }),
    t("explain.carried_answer", { answer: answerText }),
    t("explain.carried_confidence", { confidence }),
    scratch.trim() === "" ? t("explain.carried_no_scratch") : t("explain.carried_scratch"),
  ];
  const guided = mode === "guided";

  return (
    <Sheet
      open
      onClose={onClose}
      side={narrow ? "bottom" : "right"}
      title={guided ? t("explain.guided_title") : t("explain.title")}
      footer={
        <div className="flex w-full flex-col gap-2">
          <label htmlFor={inputId} className="text-small font-bold">
            {guided ? t("explain.input_guided") : t("explain.input")}
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id={inputId}
              rows={2}
              value={draft}
              disabled={unavailable}
              placeholder={guided ? t("explain.placeholder_guided") : t("explain.placeholder")}
              onChange={(event) => setDraft(event.target.value)}
              className="min-w-[0] flex-1 resize-y rounded-sm border border-line-strong bg-bg-surface px-3 py-2"
            />
            <Button variant="primary" busy={pending} disabled={unavailable || draft.trim() === ""} onClick={() => follow(draft)}>
              {t("explain.send")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <section aria-labelledby={carriedId} className="flex flex-col gap-1 rounded-md bg-bg-sunk px-4 py-3 text-small">
          <h3 id={carriedId} className="font-bold">
            {t("explain.carried_title")}
          </h3>
          <ul className="flex flex-col gap-1">
            {carried.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        {unavailable && (
          <Banner tone="info" title={t("explain.unavailable_title")}>
            {t("explain.unavailable")}
          </Banner>
        )}
        <ol aria-live="polite" className="flex flex-col gap-3">
          {turns.map((turn) =>
            turn.from === "tutor" ? (
              <li key={turn.id}>
                <AiContent note={t("explain.ai_note")}>
                  <div className="flex flex-col gap-2">
                    {turn.lines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    {turn.wrongStep !== undefined && <p className="font-bold">{t("explain.wrong_step", { n: turn.wrongStep })}</p>}
                  </div>
                </AiContent>
              </li>
            ) : (
              <li key={turn.id} className="self-end rounded-md bg-brand-primary-soft px-3 py-2">
                <span className="ui-visually-hidden">{t("explain.me")}</span>
                {turn.lines.join("")}
              </li>
            ),
          )}
        </ol>
        {pending && (
          <div aria-busy="true">
            <span className="ui-visually-hidden">{t("explain.loading")}</span>
            <Skeleton lines={3} />
          </div>
        )}
        {failed !== null && (
          <Banner
            tone="warning"
            action={
              <Button size="sm" onClick={() => request(failed)}>
                {COPY.action.retry}
              </Button>
            }
          >
            {t("explain.failed")}
          </Banner>
        )}
        {suggestions.length > 0 && !pending && !unavailable && (
          <section className="flex flex-col gap-2">
            <h3 className="text-small font-bold">{t("explain.suggest_title")}</h3>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((text) => (
                <Button key={text} size="sm" onClick={() => follow(text)}>
                  {text}
                </Button>
              ))}
            </div>
          </section>
        )}
        <Link to={pathTo("S28")} className={buttonClass("ghost", "sm")}>
          {t("explain.open_tutor")}
        </Link>
      </div>
    </Sheet>
  );
}
