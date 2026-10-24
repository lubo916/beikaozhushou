import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { S20QuestionType } from "@exam-prep/contract";
import { Button, Dialog, Segmented } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

const TYPES: readonly S20QuestionType[] = ["short_answer", "essay", "case", "composition", "translation", "calculation", "algorithm_proof"];
export type InputMethod = "keyboard" | "photo" | "voice";

// feat:S20-01 七种主观题入口；题型差异来自数据和选择，页面不按考试分支。
// feat:S20-02 三种输入。未接后端不伪造识别、录音或提交成功；键入草稿在本页关闭弹窗后仍保留。
export function AnswerDialog({
  open,
  onClose,
  method,
  input,
  onInput,
}: {
  open: boolean;
  onClose: () => void;
  method: string;
  input: InputMethod;
  onInput: (value: InputMethod) => void;
}) {
  const { t } = useTranslation("S20");
  const toast = useToast();
  const [kind, setKind] = useState<S20QuestionType>("short_answer");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("draft.title")}
      description={t("draft.description")}
      actions={
        <>
          <Button onClick={onClose}>{t("draft.cancel")}</Button>
          <Button variant="primary" onClick={() => toast(t("soon"))}>
            {t("draft.action")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          {t("question.type")}
          <select
            className="w-full rounded-sm border border-line-strong bg-bg-surface p-3 text-ink-primary"
            value={kind}
            onChange={(event) => setKind(event.target.value as S20QuestionType)}
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          {t("draft.question")}
          <textarea
            className="w-full rounded-sm border border-line-strong bg-bg-surface p-3 text-ink-primary"
            rows={2}
            placeholder={t("draft.questionPlaceholder")}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>
        <Segmented
          label={t("draft.method")}
          value={input}
          onChange={onInput}
          options={["keyboard", "photo", "voice"].map((value) => ({ value: value as InputMethod, label: t(`draft.${value}`) }))}
        />
        {input === "photo" && (
          <label className="flex flex-col gap-2">
            {t("draft.photoHint")}
            <input
              type="file"
              accept="image/*"
              aria-label={t("draft.file")}
              className="w-full rounded-sm border border-line-strong bg-bg-surface p-3 text-ink-primary"
            />
          </label>
        )}
        {input === "voice" && (
          <div className="flex flex-col gap-2">
            <p>{t("draft.voiceHint")}</p>
            <Button onClick={() => toast(t("soon"))}>{t("draft.record")}</Button>
          </div>
        )}
        <label className="flex flex-col gap-2">
          {t("draft.answer")}
          <textarea
            className="w-full rounded-sm border border-line-strong bg-bg-surface p-3 text-ink-primary"
            rows={6}
            placeholder={t("draft.placeholder")}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
          />
        </label>
        <p className="text-small text-ink-tertiary">{t(`method.${method}`)}</p>
        <p className="text-small text-ink-tertiary">{t("draft.offline")}</p>
      </div>
    </Dialog>
  );
}
