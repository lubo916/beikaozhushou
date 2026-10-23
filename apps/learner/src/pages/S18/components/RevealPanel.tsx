// 揭晓（上半先搭好顺序与入口，分层细节、错因确认、讲解入口由下半 U18b 补齐）：按原型的顺序——
// 这次记为什么证据 → 你选的为什么错与陷阱 → 一句话结论、分步看、回原文 → 生成题确认 → 错因七类 → 讲解、变式、笔记。
// 对错、证据、误选率都是接口给的值，页面只显示（红线 5）。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S18CheckVerdict, S18ErrorCause, S18QuizItem } from "@exam-prep/contract";
import { formatPercent } from "@exam-prep/shared/format";
import { vocabLabel } from "@exam-prep/shared/vocab";
import { Banner, Button, Card, PageState, Tag, buttonClass } from "@exam-prep/ui";
import { choosesOptions } from "../../../../../../packages/ui/src/quiz/index.ts";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";
import { shapeOf } from "../data.ts";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ERROR_CAUSES: readonly S18ErrorCause[] = [
  "not_learned",
  "forgot",
  "concept_unclear",
  "method_unknown",
  "misread",
  "slip",
  "time_short",
];

export interface RevealPanelProps {
  readonly item: S18QuizItem;
  readonly onCheck: (verdict: S18CheckVerdict) => void;
  readonly checking: boolean;
}

export function RevealPanel({ item, onCheck, checking }: RevealPanelProps) {
  const { t } = useTranslation("S18");
  const toast = useToast();
  const [causesOpen, setCausesOpen] = useState(true);
  const result = item.result;
  if (result === undefined) return null;
  const { solution } = result;
  const shape = shapeOf(item);
  const options = item.question.options ?? [];
  const answer = solution.answer ?? [];
  const picked = item.answer?.response.selected ?? [];
  const wrongPicks = choosesOptions(shape) ? picked.filter((index) => !answer.includes(index)) : [];
  const noPeers = choosesOptions(shape) && typeof solution.group_miss_rate !== "number";
  const headline = result.correct === true ? "correct" : result.correct === false ? "wrong" : "ungraded";
  const pointId = item.question.knowledge_point_ids[0];
  return (
    <Card title={t("reveal.title")} tone={headline === "correct" ? "success" : headline === "wrong" ? "danger" : "default"}>
      <div className="flex flex-col gap-4">
        {/* feat:S18-09 这次记为什么证据：蒙对、秒答记待验证，不升档 */}
        <section className="flex flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2 font-bold">
            {t(`reveal.${headline}`)}
            {result.correct === false && result.mistake_id !== null && (
              <Tag tone="danger" size="sm">
                {t("reveal.mistake")}
              </Tag>
            )}
          </p>
          <p className="text-small text-ink-secondary">
            {result.evidence_counted
              ? t("reveal.evidence", { strength: vocabLabel("evidence_strength", result.evidence_strength) })
              : t("reveal.evidence_none")}
            {t(`reveal.reason.${result.evidence_reason}`)}
          </p>
          {/* feat:S18-10 异题印证 */}
          {item.check !== "not_needed" && <p className="text-small text-ink-tertiary">{t("reveal.cross_check")}</p>}
        </section>
        {/* feat:S18-26 证据回溯重算 */}
        {item.revised === true && <Banner tone="warning">{t("reveal.revised")}</Banner>}
        {/* feat:S18-07 针对所选错项：先讲你选的为什么错，标出陷阱与群体误选率 */}
        {wrongPicks.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="font-bold">{t("reveal.mine_title")}</h3>
            {wrongPicks.map((index) => {
              const note = solution.option_notes?.[String(index)];
              return (
                <div key={index} className="rounded-md border border-status-danger bg-status-danger-soft px-4 py-3">
                  <p className="font-bold">{t("reveal.mine_option", { letter: LETTERS.charAt(index), text: options[index] ?? "" })}</p>
                  <p>{note?.note ?? t("reveal.no_note")}</p>
                  {note?.trap !== undefined && <p className="text-small text-status-danger">{t("reveal.trap", { trap: note.trap })}</p>}
                </div>
              );
            })}
            {typeof solution.group_miss_rate === "number" && (
              <p className="text-small text-ink-secondary">{t("reveal.miss_rate", { rate: formatPercent(solution.group_miss_rate) })}</p>
            )}
          </section>
        )}
        {noPeers && (
          <PageState state="insufficient_data" compact title={t("state.insufficient.title")} body={t("state.insufficient.body")} />
        )}
        {/* feat:S18-06 分层解析：一句话结论、分步推导、知识点回链、资料定位 */}
        <section className="flex flex-col gap-2">
          <h3 className="font-bold">{t("reveal.conclusion")}</h3>
          {solution.explanation !== undefined && <p>{solution.explanation.conclusion}</p>}
          {shape.form === "match_order" && answer.length > 0 && (
            <p>{t("reveal.order", { order: answer.map((index) => options[index] ?? "").join(t("reveal.order_join")) })}</p>
          )}
          {solution.sample_answer !== undefined && (
            <p>
              <span className="font-bold">{t("reveal.sample")}</span>
              {solution.sample_answer}
            </p>
          )}
          {solution.scoring_points !== undefined && solution.scoring_points.length > 0 && (
            <ul className="list-disc pl-5 text-small">
              {solution.scoring_points.map((entry) => (
                <li key={entry.point}>{entry.point}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => toast(t("soon.steps"))}>
              {t("reveal.steps")}
            </Button>
            <Button size="sm" onClick={() => toast(t("soon.source"))}>
              {t("reveal.source")}
            </Button>
            {pointId !== undefined && item.knowledge_point_name !== "" && (
              <Link to={pathTo("S10", { kpId: pointId })} className={buttonClass("ghost", "sm")}>
                {t("reveal.point", { name: item.knowledge_point_name })}
              </Link>
            )}
          </div>
          {/* feat:S18-23 主观题判分：自评加反思，或导师批改（事前告知消耗） */}
          {!result.graded && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => toast(t("soon.self_grade"))}>
                {t("reveal.self_grade")}
              </Button>
              <Button size="sm" variant="ai" onClick={() => toast(t("soon.tutor_grade"))}>
                {t("reveal.tutor_grade")}
              </Button>
            </div>
          )}
        </section>
        {/* feat:S18-12 生成题先做后核：确认“题目没问题”才计证据，“有问题”不计并进入报错 */}
        {item.check !== "not_needed" && (
          <section className="flex flex-col gap-2 rounded-md bg-status-ai-soft px-4 py-3">
            {item.check === "pending" ? (
              <>
                <h3 className="font-bold">{t("reveal.check_title")}</h3>
                <p className="text-small text-ink-secondary">{t("reveal.check_body")}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="primary" busy={checking} onClick={() => onCheck("ok")}>
                    {t("reveal.check_ok")}
                  </Button>
                  <Button size="sm" disabled={checking} onClick={() => onCheck("problem")}>
                    {t("reveal.check_problem")}
                  </Button>
                </div>
              </>
            ) : (
              <p>{item.check === "ok" ? t("reveal.check_done_ok") : t("reveal.check_done_problem")}</p>
            )}
          </section>
        )}
        {/* feat:S18-08 错因确认：七类、无默认、可跳过（下半 U18b 接上保存与导师建议） */}
        {result.correct === false && causesOpen && (
          <section className="flex flex-col gap-2">
            <h3 className="font-bold">{t("reveal.cause_title")}</h3>
            <div className="flex flex-wrap gap-2">
              {ERROR_CAUSES.map((cause) => (
                <Button key={cause} size="sm" onClick={() => toast(t("soon.cause"))}>
                  {vocabLabel("error_cause", cause)}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setCausesOpen(false)}>
                {t("reveal.cause_skip")}
              </Button>
            </div>
          </section>
        )}
        <div className="flex flex-wrap gap-2 border-t border-line-soft pt-3">
          {/* feat:S18-13 讲解与追问：自动带上题目、所选项、把握度与草稿 */}
          <Button size="sm" variant="ai" onClick={() => toast(t("soon.explain"))}>
            {t("reveal.explain")}
          </Button>
          {/* feat:S18-17 引导式纠错 */}
          {result.correct === false && (
            <Button size="sm" onClick={() => toast(t("soon.guided"))}>
              {t("reveal.guided")}
            </Button>
          )}
          {/* feat:S18-11 变式巩固 */}
          <Button size="sm" onClick={() => toast(t("soon.variants"))}>
            {t("reveal.variants")}
          </Button>
          {/* feat:S18-18 题目笔记与反思 */}
          <Button size="sm" onClick={() => toast(t("soon.note"))}>
            {t("reveal.note")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
