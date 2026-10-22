import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S08Report } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared/format";
import { AiBadge, AiContent, Button, Card, PageState, ProposalCard, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

export function Reflection({ data, offline }: { data: S08Report; offline: boolean }) {
  const { t } = useTranslation("S08");
  const toast = useToast();
  const [selected, setSelected] = useState<string>();
  const [own, setOwn] = useState("");
  const [preview, setPreview] = useState(false);
  const enough = data.availability !== "insufficient_data";
  const chosen = data.choices.find((choice) => choice.id === selected);
  const allowed = enough && !offline && (chosen !== undefined || (selected === "own" && own.trim() !== ""));
  const choose = (value: string) => {
    setSelected(value);
    setPreview(false);
  };
  const nextTitle = data.view === "week" ? t("sections.decision") : t("decision.next_period");
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* feat:S08-10 教练点评必须带样本量；受限只收起导师部分。 */}
      <Card title={t("sections.coach")}>
        {data.availability === "restricted" ? (
          <PageState
            state="restricted"
            title={t("state.restricted.title")}
            body={t("state.restricted.body")}
            action={
              <Link to={pathTo("S31")} className={buttonClass("secondary", "sm")}>
                {t("state.restricted.action")}
              </Link>
            }
          />
        ) : enough ? (
          <AiContent note={t("coach_sample", { samples: formatCount(data.sample_count, t("unit.evidence")) })}>
            <p>{data.coach}</p>
            <p className="mt-3 text-small text-ink-secondary">{t("coach_note")}</p>
          </AiContent>
        ) : (
          <p>{t("decision.unavailable")}</p>
        )}
      </Card>
      {/* feat:S08-09 最有效、最浪费两个问题；第三问仅在唯一决定区填写。 */}
      <Card title={t("sections.questions")}>
        <div className="space-y-3">
          {(["effective", "waste"] as const).map((key) => (
            <label key={key} className="flex flex-col gap-2 text-small">
              {t(`questions.${key}`)}
              <textarea
                className="w-full rounded-sm border border-line-strong bg-bg-surface p-3 text-body"
                rows={3}
                placeholder={t("questions.placeholder")}
              />
            </label>
          ))}
          <Button disabled={offline} onClick={() => toast(t("save_soon"))}>
            {t("questions.save")}
          </Button>
        </div>
      </Card>
      {/* feat:S08-04 单选无默认；feat:S08-06 全页唯一计划决定点，先预览提议。 */}
      <Card
        title={nextTitle}
        footer={
          <Link to={pathTo("S07")} className={buttonClass("ghost", "sm")}>
            {t("links.plan")}
          </Link>
        }
      >
        <p className="mb-3 text-small text-ink-secondary">{t("decision.hint")}</p>
        {offline && <p className="mb-3 text-small text-status-warning">{t("decision.offline")}</p>}
        {enough ? (
          <>
            <fieldset disabled={offline} className="space-y-3">
              <legend className="sr-only">{nextTitle}</legend>
              {data.choices.map((choice) => (
                <label key={choice.id} className="flex items-start gap-2 rounded-sm border border-line-soft p-3">
                  <input
                    type="radio"
                    name="s08-change"
                    value={choice.id}
                    checked={selected === choice.id}
                    onChange={() => choose(choice.id)}
                    className="mt-1"
                  />
                  <span>
                    {choice.title}
                    {choice.ai_generated && (
                      <span className="ml-2">
                        <AiBadge size="xs" />
                      </span>
                    )}
                  </span>
                </label>
              ))}
              <label className="flex items-center gap-2 rounded-sm border border-line-soft p-3">
                <input type="radio" name="s08-change" value="own" checked={selected === "own"} onChange={() => choose("own")} />
                {t("decision.own")}
              </label>
              {selected === "own" && (
                <label className="flex flex-col gap-2 text-small">
                  {t("decision.own_label")}
                  <textarea
                    value={own}
                    onChange={(event) => {
                      setOwn(event.target.value);
                      setPreview(false);
                    }}
                    rows={3}
                    className="w-full rounded-sm border border-line-strong bg-bg-surface p-3 text-body"
                    placeholder={t("decision.placeholder")}
                  />
                </label>
              )}
            </fieldset>
            <Button className="mt-3" variant="primary" disabled={!allowed} onClick={() => setPreview(true)}>
              {t("decision.confirm")}
            </Button>
            {preview && allowed && (
              <div className="mt-3">
                <ProposalCard
                  title={t("decision.pending")}
                  status="pending"
                  what={chosen?.title ?? own.trim()}
                  why={chosen?.reason ?? t("decision.own_reason")}
                  cost={chosen?.cost ?? t("decision.own_cost")}
                  ifNot={chosen?.if_declined ?? t("decision.own_declined")}
                  aiGenerated={chosen?.ai_generated ?? false}
                  onConfirm={() => toast(t("plan_soon"))}
                  onDecline={() => {
                    setPreview(false);
                    setSelected(undefined);
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <p>{t("decision.unavailable")}</p>
        )}
      </Card>
      {/* feat:S08-14 一键反馈；权限尚未登记，提示即将上线，不伪报提交成功。 */}
      <Card title={t("sections.feedback")}>
        <p className="mb-3 text-small text-ink-secondary">{t("feedback.hint")}</p>
        <div className="flex flex-wrap gap-2">
          {(["yes", "no"] as const).map((key) => (
            <Button key={key} disabled={offline} onClick={() => toast(t("feedback_soon"))}>
              {t(`feedback.${key}`)}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
