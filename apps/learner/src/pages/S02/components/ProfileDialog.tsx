import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { EvaluationRuleType, S02ExamChoice } from "@exam-prep/contract";
import { AiContent, Banner, Button, Dialog, Tag } from "@exam-prep/ui";
import { useNarrow } from "../../../app/useNarrow.ts";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";
import { Field, fieldClass } from "../fields.tsx";

export function ProfileDialog({
  choice,
  onClose,
  editing = false,
  contents = [],
}: {
  choice: S02ExamChoice;
  onClose: () => void;
  editing?: boolean;
  contents?: readonly string[];
}) {
  const { t } = useTranslation("S02");
  const navigate = useNavigate();
  const toast = useToast();
  const frame = useRef<HTMLDivElement>(null);
  const narrow = useNarrow(frame);
  const formId = useId();
  const [name, setName] = useState(choice.name);
  const [subjects, setSubjects] = useState(
    choice.profile.structure.map((subject) => ({ id: subject.subject, name: subject.subject, selected: true })),
  );
  const [fullScore, setFullScore] = useState(String(choice.profile.full_score));
  const [duration, setDuration] = useState(String(choice.profile.duration_minutes ?? ""));
  const [details, setDetails] = useState({
    form: choice.form,
    question_distribution: choice.question_distribution,
    validity: choice.validity,
    suggestion: choice.suggestion,
  });
  const [date, setDate] = useState(choice.target_date);
  const [score, setScore] = useState(String(choice.target_score));
  const [rule, setRule] = useState<EvaluationRuleType>(choice.profile.evaluation_rule.type);
  const [changed, setChanged] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const markChanged = () => setChanged(true);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (
      name.trim() === "" ||
      date === "" ||
      score.trim() === "" ||
      fullScore.trim() === "" ||
      !subjects.some((subject) => subject.selected && subject.name.trim() !== "")
    ) {
      setInvalid(true);
      return;
    }
    if (editing) {
      toast(t("soon"));
      onClose();
      return;
    }
    toast(t("profile.save_soon"));
    void navigate(pathTo("S03"), {
      state: {
        goal_draft: {
          name,
          subjects: subjects
            .filter((subject) => subject.selected)
            .map((subject) => subject.name.trim())
            .filter(Boolean),
          target_date: date,
          target_score: score,
          evaluation_rule: rule,
          full_score: fullScore,
          duration_minutes: duration,
          ...details,
          contents,
        },
      },
    });
  };
  // feat:S02-04 完整画像可手动编辑；没有写权限的保存按钮提示即将上线。
  // feat:S02-05 评价规则四选一；feat:S02-06 目标分；feat:S02-07 目标日与预计依据。
  // feat:S02-11 同一确认面板在手机底部显示，其他宽度使用对话框。
  return (
    <div ref={frame} className="@container">
      <Dialog
        open
        onClose={onClose}
        title={t("profile.title")}
        description={t("profile.description")}
        className={narrow ? "s02-profile s02-profile--bottom" : "s02-profile"}
        actions={
          <>
            <Button onClick={onClose}>{t("profile.cancel")}</Button>
            <Button variant="primary" type="submit" form={formId}>
              {t(editing ? "profile.save" : "profile.next")}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t("profile.name")}>
            <input
              required
              className={fieldClass}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                markChanged();
              }}
            />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-small font-medium text-ink-secondary">{t("profile.subject")}</legend>
            {subjects.map((subject) => (
              <div key={subject.id} className="flex min-w-[0] items-center gap-2">
                <input
                  aria-label={t("profile.include_subject", { name: subject.name })}
                  type="checkbox"
                  checked={subject.selected}
                  onChange={(event) => {
                    setSubjects(subjects.map((item) => (item.id === subject.id ? { ...item, selected: event.target.checked } : item)));
                    markChanged();
                  }}
                />
                <input
                  aria-label={t("profile.subject_name")}
                  className={fieldClass}
                  value={subject.name}
                  onChange={(event) => {
                    setSubjects(subjects.map((item) => (item.id === subject.id ? { ...item, name: event.target.value } : item)));
                    markChanged();
                  }}
                />
              </div>
            ))}
            <div>
              <Button
                size="sm"
                onClick={() => {
                  setSubjects([...subjects, { id: crypto.randomUUID(), name: "", selected: true }]);
                  markChanged();
                }}
              >
                {t("profile.add_subject")}
              </Button>
            </div>
          </fieldset>
          {contents.length > 0 && (
            <p className="text-small text-ink-secondary">
              {t("profile.scope")}：{contents.join("、")}
            </p>
          )}
          <div className="grid min-w-[0] grid-cols-1 gap-3 @tablet:grid-cols-2">
            <Field label={t("profile.date")}>
              <input
                className={fieldClass}
                type="date"
                required
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  markChanged();
                }}
              />
            </Field>
            <Field label={t("profile.score")}>
              <input
                className={fieldClass}
                type="number"
                required
                min="0"
                step="any"
                max={fullScore}
                value={score}
                onChange={(event) => {
                  setScore(event.target.value);
                  markChanged();
                }}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-1 text-small text-ink-secondary">
            {choice.estimated && date === choice.target_date && (
              <span>
                <Tag tone="warning">{t("profile.estimated")}</Tag>
              </span>
            )}
            <p>
              {t("profile.date_basis")}：{date === choice.target_date ? choice.date_basis : t("profile.date_custom")}
            </p>
            <p>
              {t("profile.target_basis")}：
              {score === String(choice.target_score) && rule === choice.profile.evaluation_rule.type
                ? choice.target_basis
                : t("profile.target_custom")}
            </p>
          </div>
          <Field label={t("profile.rule")}>
            <select
              className={fieldClass}
              value={rule}
              onChange={(event) => {
                setRule(event.target.value as EvaluationRuleType);
                markChanged();
              }}
            >
              {(["pass_line", "selective", "score_band", "custom"] as const).map((value) => (
                <option value={value} key={value}>
                  {t(`rule.${value}`)}
                </option>
              ))}
            </select>
          </Field>
          <AiContent note={t("profile.assessment")}>
            <p>{changed ? t("profile.assessment_hint") : choice.assessment}</p>
          </AiContent>
          <details className="rounded-sm border border-line-soft p-3">
            <summary className="cursor-pointer font-medium text-brand-primary">{t("profile.details")}</summary>
            <div className="mt-3 flex flex-col gap-3">
              <Field label={t("profile.full_score")}>
                <input
                  className={fieldClass}
                  type="number"
                  min="1"
                  required
                  value={fullScore}
                  onChange={(event) => {
                    setFullScore(event.target.value);
                    markChanged();
                  }}
                />
              </Field>
              <Field label={t("profile.duration")}>
                <input
                  className={fieldClass}
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(event) => {
                    setDuration(event.target.value);
                    markChanged();
                  }}
                />
              </Field>
              {(["form", "question_distribution", "validity", "suggestion"] as const).map((key) => (
                <Field key={key} label={t(`profile.${key}`)}>
                  <textarea
                    className={fieldClass}
                    value={details[key]}
                    onChange={(event) => {
                      setDetails({ ...details, [key]: event.target.value });
                      markChanged();
                    }}
                  />
                </Field>
              ))}
              <p className="text-small">
                {t("profile.map_version")}：{choice.map_version} {choice.map_pending && <Tag tone="warning">{t("profile.pending")}</Tag>}
              </p>
            </div>
          </details>
          {invalid && <Banner tone="danger" title={t("profile.required")} />}
        </form>
      </Dialog>
    </div>
  );
}
