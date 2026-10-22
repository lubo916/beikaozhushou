// 题目卡（S18-01 至 S18-05、S18-16、S18-22、S18-28）：题型、知识点、题源；题干与作答；纸笔动作；把握度；本题用时；提交。
// 作答、把握度、纸笔动作、提交条都用全站共用的作答组件（packages/ui/src/quiz/）；测评态的限制只落在这张卡里（受限，F08-Q1）。
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { S18QuizItem, S18QuizSession } from "@exam-prep/contract";
import { formatSeconds } from "@exam-prep/shared/format";
import { credibilityLabel } from "@exam-prep/shared/vocab";
import { AiContent, Banner, Button, Card, PageState, Tag } from "@exam-prep/ui";
import {
  AnswerInput,
  ConfidencePicker,
  PaperTools,
  QuestionStem,
  SubmitBar,
  choosesOptions,
  submitBlocker,
  type QuizConfidence,
  type QuizResponse,
} from "../../../../../../packages/ui/src/quiz/index.ts";
import { useToast } from "../../../app/toast.tsx";
import { isMultiple, shapeOf } from "../data.ts";

const MS_PER_SECOND = 1000;

export interface QuestionCardProps {
  readonly session: S18QuizSession;
  readonly item: S18QuizItem;
  readonly response: QuizResponse;
  readonly onResponse: (value: QuizResponse) => void;
  readonly confidence: QuizConfidence | null;
  readonly onConfidence: (value: QuizConfidence) => void;
  readonly scratch: string;
  readonly onScratch: (text: string) => void;
  readonly struck: readonly number[];
  readonly onStrike: (index: number) => void;
  readonly strikeMode: boolean;
  readonly onStrikeMode: (on: boolean) => void;
  readonly flagged: boolean;
  readonly onFlag: () => void;
  /** 这次打开这题后走过的秒数（本题用时）。 */
  readonly seconds: number;
  readonly busy: boolean;
  readonly onSubmit: () => void;
  /** 揭晓后的下一步按钮（下一题、看小结）。 */
  readonly after: ReactNode;
}

export function QuestionCard(props: QuestionCardProps) {
  const { session, item } = props;
  const { t } = useTranslation("S18");
  const toast = useToast();
  const shape = shapeOf(item);
  const revealed = item.status === "revealed";
  const generated = item.check !== "not_needed";
  const hints = item.question.hints?.length ?? 0;
  const used = revealed && item.answer !== undefined ? Math.round(item.answer.duration_ms / MS_PER_SECOND) : props.seconds;
  // feat:S18-03 固定流程：作答 → 选把握度 → 提交 → 揭晓，揭晓后锁定
  const blocker = submitBlocker(shape, props.response, props.confidence, session.confidence_enabled);
  const source = generated ? (
    <>
      {item.check === "pending" && (
        <Tag tone="warning" size="sm">
          {t("question.pending_check")}
        </Tag>
      )}
      {item.check === "ok" && (
        <Tag tone="ai" size="sm">
          {credibilityLabel(item.question.credibility)}
        </Tag>
      )}
      {item.check === "problem" && (
        <Tag tone="danger" size="sm">
          {t("question.problem")}
        </Tag>
      )}
    </>
  ) : (
    <Tag tone={item.question.credibility === "reviewed" ? "success" : "neutral"} size="sm">
      {credibilityLabel(item.question.credibility)}
    </Tag>
  );
  const stem = (
    <QuestionStem
      stem={item.question.stem}
      typeLabel={item.question.label ?? t(`question.qtype.${item.question.question_type}`)}
      pointLabel={item.knowledge_point_name === "" ? undefined : item.knowledge_point_name}
      source={source}
      material={item.material}
    />
  );
  return (
    <Card>
      <div className="flex flex-col gap-4">
        {/* feat:S18-02 测评态：不能切换模式、不能看提示（受限只落在这张卡里） */}
        {(session.restrictions.mode_locked || session.restrictions.hints_locked) && (
          <PageState state="restricted" compact title={t("state.restricted.title")} body={t("state.restricted.body")} />
        )}
        {/* feat:S18-28 练习多端互斥 */}
        {session.other_device && <Banner tone="warning">{t("question.other_device")}</Banner>}
        {/* 导师生成的题带 AI 生成标识（红线 4） */}
        {generated ? <AiContent>{stem}</AiContent> : stem}
        {/* feat:S18-01 九种作答形态 */}
        <AnswerInput
          {...shape}
          value={props.response}
          onChange={props.onResponse}
          multiple={isMultiple(item)}
          locked={revealed}
          answer={revealed ? item.result?.solution.answer : undefined}
          struck={props.struck}
          strikeMode={props.strikeMode}
          onStrike={props.onStrike}
          onPlay={() => toast(t("soon.play"))}
          onRecord={() => toast(t("soon.record"))}
          label={t("question.answer_label")}
        />
        {/* feat:S18-05 纸笔动作：草稿、标记、划掉选项、计算器 */}
        <PaperTools
          draft={props.scratch}
          onDraft={props.onScratch}
          strikeMode={props.strikeMode}
          onStrikeMode={props.onStrikeMode}
          canStrike={choosesOptions(shape)}
          flagged={props.flagged}
          onFlag={props.onFlag}
          locked={revealed}
        />
        {/* feat:S18-04 把握度：必选、无默认，可关闭 */}
        <ConfidencePicker value={props.confidence} onChange={props.onConfidence} locked={revealed} off={!session.confidence_enabled} />
        <p className="text-small text-ink-tertiary tabular-nums">
          {t("question.timing", { used: formatSeconds(used), suggested: formatSeconds(item.suggested_seconds) })}
        </p>
        {item.status === "answered" && <p className="text-small text-ink-secondary">{t("question.answered_wait")}</p>}
        <SubmitBar blocker={blocker} onSubmit={props.onSubmit} busy={props.busy} locked={revealed}>
          {revealed
            ? props.after
            : hints > 0 &&
              !session.restrictions.hints_locked && (
                // feat:S18-16 提示阶梯（下半 U18b 接上）
                <Button size="sm" onClick={() => toast(t("soon.hint"))}>
                  {t("question.hint", { used: 0, total: hints })}
                </Button>
              )}
        </SubmitBar>
      </div>
    </Card>
  );
}
