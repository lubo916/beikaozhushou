import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S19MistakeRow } from "@exam-prep/contract";
import { formatDate, formatNumber } from "@exam-prep/shared/format";
import { Button, Card, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

const CAUSES = ["not_learned", "forgot", "concept_unclear", "method_unknown", "misread", "slip", "time_short"] as const;
const TRAPS = [
  "concept_swap",
  "scope_widen",
  "scope_narrow",
  "absolutize",
  "time_confusion",
  "subject_confusion",
  "cause_reversal",
  "partially_true",
  "true_but_irrelevant",
  "over_inference",
  "boundary_break",
  "ignore_exception",
] as const;

export function MistakeDetail({ row }: { row: S19MistakeRow }) {
  const { t } = useTranslation("S19");
  const toast = useToast();
  const [cause, setCause] = useState<string>(row.cause_code);
  const [trap, setTrap] = useState<string>(row.trap_code);
  const [draft, setDraft] = useState(row.correction);
  return (
    <Card title={t("detail.title")} meta={t("list.retry_count", { total: formatNumber(row.retry_count, 0) })} className="s19-detail">
      <h3 className="mb-2 font-bold">{t("detail.lifecycle")}</h3>
      {/* feat:S19-05 毕业由服务端判断；页面不以点击或自评改状态。 */}
      <ol className="mb-4 flex flex-wrap gap-2">
        {(["new", "retrying", "awaiting_check", "graduated"] as const).map((status) => (
          <li key={status}>
            <Tag tone={status === row.mistake.status ? "brand" : "neutral"}>{t(`status.${status}`)}</Tag>
          </li>
        ))}
      </ol>
      {row.mistake.status === "graduated" && <p className="mb-3 text-small">{t("detail.archived")}</p>}
      <p className="mb-4">{row.stem}</p>
      {/* feat:S19-06 统一错因与补救动作；feat:S19-08 第二层陷阱 */}
      <h3 className="mb-2 font-bold">{t("detail.cause")}</h3>
      <p className="mb-2 text-small text-ink-secondary">{t("detail.cause_hint")}</p>
      <div className="s19-fields">
        <label className="s19-field">
          <span>{t("filters.cause")}</span>
          <select aria-label={t("filters.cause")} value={cause} onChange={(event) => setCause(event.target.value)}>
            {CAUSES.map((code) => (
              <option key={code} value={code}>
                {t(`cause.${code}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="s19-field">
          <span>{t("filters.trap")}</span>
          <select aria-label={t("filters.trap")} value={trap} onChange={(event) => setTrap(event.target.value)}>
            {TRAPS.map((code) => (
              <option key={code} value={code}>
                {t(`trap.${code}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="my-3 text-small">
        <strong>{t("detail.remedy")}：</strong>
        {t(`remedy.${cause}`)}
      </p>
      {/* feat:S19-09 三步订正只保存学员原文，不自动混入AI内容 */}
      <h3 className="mb-2 font-bold">{t("detail.correction")}</h3>
      <p className="mb-3 text-small text-ink-secondary">{t("detail.correction_hint")}</p>
      <div className="flex flex-col gap-3">
        {(["thought", "wrong_step", "signal"] as const).map((key) => (
          <label key={key} className="s19-field">
            <span>{t(`detail.${key}`)}</span>
            <textarea
              aria-label={t(`detail.${key}`)}
              value={draft[key]}
              rows={3}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      <Button className="mt-3" onClick={() => toast(t("soon_save"))}>
        {t("actions.save")}
      </Button>
      {/* feat:S19-04 间隔回炉：盲做、把握度、提交揭晓入口 */}
      <p className="my-3 text-small text-ink-secondary">{t("detail.workflow")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => toast(t("soon_retry"))}>
          {t("actions.retry")}
        </Button>
        <Button onClick={() => toast(t("soon"))}>{t("actions.variant")}</Button>
        {/* feat:S19-15 生成辨析卡须先确认 */}
        <Button onClick={() => toast(t("soon_card"))}>{t("actions.card")}</Button>
      </div>
      <details className="my-4">
        <summary>{t("actions.answer")}</summary>
        <p className="mt-2">{row.solution}</p>
      </details>
      <h3 className="mb-2 font-bold">{t("detail.history")}</h3>
      <ul className="mb-4 flex flex-col gap-2 text-small">
        {row.history.map((entry, index) => (
          <li key={index}>
            {formatDate(entry.day)} · {t(`detail.result_${entry.result}`)} · {t(`detail.${entry.confidence}`)}
          </li>
        ))}
      </ul>
      <div className="s19-detail-actions flex flex-wrap gap-2">
        <Link className={buttonClass("secondary", "sm")} to={pathTo("S10", { kpId: row.mistake.knowledge_point_ids[0] ?? "demo" })}>
          {t("actions.point")}
        </Link>
        <Link className={buttonClass("secondary", "sm")} to={pathTo("S14")}>
          {t("actions.notes")}
        </Link>
        {/* feat:S19-10 顽固题、feat:S19-19 攻坚包入口 */}
        {row.mistake.tags.includes("stubborn") && (
          <>
            <Button size="sm" onClick={() => toast(t("soon"))}>
              {t("actions.attack")}
            </Button>
            <Button size="sm" onClick={() => toast(t("soon"))}>
              {t("actions.trace")}
            </Button>
          </>
        )}
        <Button size="sm" onClick={() => toast(t("soon_remove"))}>
          {t("actions.remove")}
        </Button>
      </div>
    </Card>
  );
}
