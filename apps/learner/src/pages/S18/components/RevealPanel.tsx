// 揭晓（U18b 下半补齐分层）：放在题目卡里、选项下面（原型），顺序是——这次记为什么证据 → 你选的为什么错与陷阱 → 一句话、分步看、
// 回原文、看视频这一刻、回知识点 → 生成题确认 → 错因确认 → 讲解与追问、引导我想、变式与更多。
// 对错、证据、误选率、分步、资料位置、导师建议都是接口给的值，页面只显示（红线 5）。
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S18CheckVerdict, S18ErrorCause, S18ExplainMode, S18QuizItem } from "@exam-prep/contract";
import { formatPercent } from "@exam-prep/shared/format";
import { vocabLabel } from "@exam-prep/shared/vocab";
import { Banner, Button, PageState, Tag, buttonClass, cx } from "@exam-prep/ui";
import { choosesOptions } from "../../../../../../packages/ui/src/quiz/index.ts";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";
import { LETTERS, revealTone, shapeOf, sourceOf, wrongPicks, type RevealTone } from "../data.ts";
import { CausePicker } from "./CausePicker.tsx";

const TONE: Readonly<Record<RevealTone, string>> = {
  wrong: "border-status-danger bg-status-danger-soft",
  pending: "border-status-warning bg-status-warning-soft",
  correct: "border-status-success bg-status-success-soft",
  neutral: "border-line-strong bg-bg-sunk",
};
const SECTION = "flex flex-col gap-2 border-t border-line-soft pt-4";

export interface RevealPanelProps {
  readonly item: S18QuizItem;
  readonly onCheck: (verdict: S18CheckVerdict) => void;
  readonly checking: boolean;
  /** 我选的错因（含刚点、还在记的）。 */
  readonly cause: S18ErrorCause | null;
  readonly onCause: (cause: S18ErrorCause) => void;
  /** 打开讲解与追问（explain）或引导我想（guided）。 */
  readonly onExplain: (mode: S18ExplainMode) => void;
}

export function RevealPanel({ item, onCheck, checking, cause, onCause, onExplain }: RevealPanelProps) {
  const { t } = useTranslation("S18");
  const toast = useToast();
  const titleId = useId();
  const stepsId = useId();
  const moreId = useId();
  const [stepsOpen, setStepsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const result = item.result;
  if (result === undefined) return null;
  const { solution, layers } = result;
  const shape = shapeOf(item);
  const options = item.question.options ?? [];
  const answer = solution.answer ?? [];
  const mistakes = wrongPicks(item);
  const onlyMistake = mistakes.length === 1 ? mistakes[0] : undefined;
  const missRate = typeof solution.group_miss_rate === "number" ? solution.group_miss_rate : null;
  const noPeers = choosesOptions(shape) && missRate === null;
  const headline = result.correct === true ? "correct" : result.correct === false ? "wrong" : "ungraded";
  const pointId = item.question.knowledge_point_ids[0];
  const places = [sourceOf(layers, "material"), sourceOf(layers, "video")];
  const [material, video] = places;
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <h2 id={titleId} className="text-small font-bold text-ink-tertiary">
        {t("reveal.title")}
      </h2>
      {/* feat:S18-09 这次记为什么证据：蒙对、秒答记待验证，不升档 */}
      <div className={cx("flex flex-col gap-1 rounded-sm border-l-4 px-4 py-3", TONE[revealTone(result)])}>
        <p className="flex flex-wrap items-center gap-2 font-bold">
          {t(`reveal.${headline}`)}
          {result.correct === false && result.mistake_id !== null && (
            <Tag tone="danger" size="sm">
              {t("reveal.mistake")}
            </Tag>
          )}
        </p>
        <p className="text-small">
          {result.evidence_counted
            ? t("reveal.evidence", { strength: vocabLabel("evidence_strength", result.evidence_strength) })
            : t("reveal.evidence_none")}
          {t(`reveal.reason.${result.evidence_reason}`)}
        </p>
        {/* feat:S18-10 异题印证 */}
        {item.check !== "not_needed" && <p className="text-small text-ink-secondary">{t("reveal.cross_check")}</p>}
      </div>
      {/* feat:S18-26 证据回溯重算 */}
      {item.revised === true && <Banner tone="warning">{t("reveal.revised")}</Banner>}
      {/* feat:S18-07 针对所选错项：先讲你选的为什么错，标出陷阱类型与群体误选率 */}
      {mistakes.length > 0 && (
        <section className={SECTION}>
          <h3 className="font-bold">
            {onlyMistake === undefined ? t("reveal.mine_title") : t("reveal.mine_title_one", { text: options[onlyMistake] ?? "" })}
          </h3>
          {mistakes.map((index) => {
            const note = solution.option_notes?.[String(index)];
            const common = missRate !== null && solution.common_wrong_option === index;
            return (
              <div key={index} className="flex flex-col gap-1">
                {onlyMistake === undefined && (
                  <p className="font-bold">{t("reveal.mine_option", { letter: LETTERS.charAt(index), text: options[index] ?? "" })}</p>
                )}
                <p>{note?.note ?? t("reveal.no_note")}</p>
                {(note?.trap !== undefined || common) && (
                  <p className="flex flex-wrap gap-x-3 text-small text-ink-secondary">
                    {note?.trap !== undefined && <span className="text-status-danger">{t("reveal.trap", { trap: note.trap })}</span>}
                    {common && <span>{t("reveal.common_pick")}</span>}
                  </p>
                )}
              </div>
            );
          })}
          {missRate !== null && <p className="text-small text-ink-secondary">{t("reveal.miss_rate", { rate: formatPercent(missRate) })}</p>}
        </section>
      )}
      {noPeers && <PageState state="insufficient_data" compact title={t("state.insufficient.title")} body={t("state.insufficient.body")} />}
      {/* feat:S18-06 分层解析：一句话结论、分步推导、资料定位（回原文、看视频这一刻）、知识点回链 */}
      <section className={SECTION}>
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
          {layers.steps.length > 0 && (
            <Button
              size="sm"
              aria-expanded={stepsOpen}
              aria-controls={stepsOpen ? stepsId : undefined}
              onClick={() => setStepsOpen((open) => !open)}
            >
              {stepsOpen ? t("reveal.steps_hide") : t("reveal.steps")}
            </Button>
          )}
          {/* 回原文、看视频这一刻：先到阅读器、视听课堂那一页，位置写在下面（U18b-Q2＝A） */}
          {material !== undefined && (
            <Link to={pathTo("S12", { docId: material.ref_id })} className={buttonClass("secondary", "sm")}>
              {t("reveal.source")}
            </Link>
          )}
          {video !== undefined && (
            <Link to={pathTo("S13")} className={buttonClass("secondary", "sm")}>
              {t("reveal.video")}
            </Link>
          )}
          {pointId !== undefined && item.knowledge_point_name !== "" && (
            <Link to={pathTo("S10", { kpId: pointId })} className={buttonClass("ghost", "sm")}>
              {t("reveal.point", { name: item.knowledge_point_name })}
            </Link>
          )}
        </div>
        {stepsOpen && (
          <ol id={stepsId} className="flex flex-col gap-1 rounded-md bg-bg-sunk px-4 py-3">
            {layers.steps.map((step, index) => (
              <li key={step}>{t("reveal.step_item", { n: index + 1, text: step })}</li>
            ))}
          </ol>
        )}
        {(material ?? video) !== undefined && (
          <p className="text-small text-ink-tertiary">
            {places
              .flatMap((place) =>
                place === undefined
                  ? []
                  : [
                      t(place.kind === "video" ? "reveal.video_where" : "reveal.source_where", {
                        title: place.title,
                        locator: place.locator,
                      }),
                    ],
              )
              .join(t("reveal.source_join"))}
          </p>
        )}
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
        <section className="flex flex-col gap-2 rounded-md border border-dashed border-status-warning-line bg-status-warning-soft px-4 py-3">
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
      {/* feat:S18-08 错因确认：七类、无默认、可跳过、可改选；导师建议错因（AI 初判）供采纳 */}
      {result.correct === false && <CausePicker className={SECTION} chosen={cause} suggested={layers.suggested_cause} onChoose={onCause} />}
      <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
        {/* feat:S18-13 讲解与追问：自动带上题目、所选项、把握度与草稿 */}
        <Button size="sm" variant="ai" onClick={() => onExplain("explain")}>
          {t("reveal.explain")}
        </Button>
        {/* feat:S18-17 引导式纠错：先问我怎么想的，导师指出第几步出了问题 */}
        <Button size="sm" onClick={() => onExplain("guided")}>
          {t("reveal.guided")}
        </Button>
        {/* feat:S18-11 变式巩固（U18b-Q4＝A：这一轮先提示即将上线） */}
        <Button size="sm" onClick={() => toast(t("soon.variants"))}>
          {t("reveal.variants")}
        </Button>
        {/* feat:S18-18 题目笔记与反思（更多里：记笔记、写反思、做成卡） */}
        <Button
          size="sm"
          variant="ghost"
          aria-label={t("reveal.more_label")}
          aria-expanded={moreOpen}
          aria-controls={moreOpen ? moreId : undefined}
          onClick={() => setMoreOpen((open) => !open)}
        >
          {t("reveal.more")}
        </Button>
      </div>
      {moreOpen && (
        <div id={moreId} className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => toast(t("soon.note"))}>
            {t("reveal.note")}
          </Button>
          <Button size="sm" onClick={() => toast(t("soon.reflect"))}>
            {t("reveal.reflect")}
          </Button>
          <Button size="sm" onClick={() => toast(t("soon.card"))}>
            {t("reveal.card")}
          </Button>
        </div>
      )}
    </section>
  );
}
