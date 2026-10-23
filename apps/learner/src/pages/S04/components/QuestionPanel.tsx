// 一道题：共用作答组件（U18a 的题干、作答区、提交条）＋本页的把握度四档（feat:S04-05）＋主观题对照得分点自评（feat:S04-11）。
// 测评态（feat:S04-04）：提交后不揭晓、不显示对错，直接出下一题；题目里不给提示。中途只留“改用快速定位”，已答的题保留（feat:S04-09）。
// 题号、模块、题源都由接口给（feat:S04-01 自适应选题、feat:S04-06 题源与可信度）；一题一个组件实例，换题时作答与计时重新开始。
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { S04AnswerInput, S04Confidence, S04Item } from "@exam-prep/contract";
import { credibilityLabel } from "@exam-prep/shared/vocab";
import { Button, Card } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import {
  AnswerInput,
  QuestionStem,
  SubmitBar,
  emptyResponse,
  isAnswered,
  toWireResponse,
  type QuizResponse,
} from "../../../../../../packages/ui/src/quiz/index.ts";
import { diagnosisBlocker, isMultiple, shapeOf, useDiagnosisActions } from "../data.ts";
import { ConfidenceChoice } from "./ConfidenceChoice.tsx";
import { SelfCheck } from "./SelfCheck.tsx";

export interface QuestionPanelProps {
  readonly sessionId: string;
  readonly item: S04Item;
  readonly onSwitchQuick: () => void;
  readonly switching: boolean;
}

export function QuestionPanel({ sessionId, item, onSwitchQuick, switching }: QuestionPanelProps) {
  const { t } = useTranslation("S04");
  const toast = useToast();
  const { submit } = useDiagnosisActions();
  const shape = shapeOf(item);
  const [response, setResponse] = useState<QuizResponse>(() => emptyResponse(shape));
  const [confidence, setConfidence] = useState<S04Confidence | null>(null);
  const [checked, setChecked] = useState<readonly number[]>([]);
  const started = useRef<number | null>(null);
  useEffect(() => {
    started.current = Date.now();
  }, []);
  const blocker = diagnosisBlocker(shape, response, confidence);
  const points = item.scoring_points ?? [];

  const handIn = () => {
    if (blocker !== null || confidence === null || submit.isPending) return;
    const now = Date.now();
    const data: S04AnswerInput = {
      item_id: item.id,
      question_id: item.question.id,
      question_version: item.question.version,
      response: toWireResponse(shape, response),
      confidence,
      duration_ms: Math.max(0, now - (started.current ?? now)),
      ...(points.length > 0 && checked.length > 0 ? { self_check: [...checked] } : {}),
    };
    submit.mutate({ sessionId, data }, { onError: () => toast(t("test.submit_failed")) });
  };

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <QuestionStem
          stem={item.question.stem}
          typeLabel={item.question.label ?? t(`test.qtype.${item.question.question_type}`)}
          source={
            <>
              <span>{t("test.module", { name: item.module_name })}</span>
              <span>{t("test.source", { label: credibilityLabel(item.question.credibility) })}</span>
            </>
          }
          material={item.material}
        />
        <AnswerInput
          form={shape.form}
          options={shape.options}
          parts={shape.parts}
          value={response}
          onChange={setResponse}
          multiple={isMultiple(item)}
          label={t("test.answer_label")}
          onPlay={item.question.response_form === "listening" ? () => toast(t("soon.play")) : undefined}
        />
        <ConfidenceChoice value={confidence} onChange={setConfidence} />
        {points.length > 0 && (
          <SelfCheck
            points={points}
            waitSeconds={item.self_check_after_seconds ?? 0}
            answered={isAnswered(shape, response)}
            value={checked}
            onChange={setChecked}
          />
        )}
        <SubmitBar blocker={blocker} onSubmit={handIn} busy={submit.isPending}>
          <Button variant="ghost" busy={switching} onClick={onSwitchQuick}>
            {t("test.switch_quick")}
          </Button>
        </SubmitBar>
      </div>
    </Card>
  );
}
