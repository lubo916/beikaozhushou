// 摸底结果（交卷后）：结束原因与共答几题；分模块估计（feat:S04-08：能力估计换成掌握档的范围，接口给；没测到的标同类数据或无依据）；
// 诊断错题（feat:S04-13：不自动进错题本，交卷后才显示正确答案，勾选后手动加入，规则卡 R12）；最后去看起点报告（S05）。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S04ModuleProgress, S04Session } from "@exam-prep/contract";
import { MASTERY_RANKS, masteryLabel, type MasteryRank } from "@exam-prep/shared/vocab";
import { Button, Card, Tag, buttonClass, cx } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";
import { useDiagnosisActions } from "../data.ts";
import { ModuleNote } from "./ModuleProgress.tsx";

const rankOf = (value: number | undefined): MasteryRank | undefined => MASTERY_RANKS.find((rank) => rank === value);

export function FinishCard({ session }: { readonly session: S04Session }) {
  const { t } = useTranslation("S04");
  const toast = useToast();
  const { addMistakes } = useDiagnosisActions();
  const [picked, setPicked] = useState<readonly string[]>([]);
  const open = session.mistakes.filter((row) => !row.added);
  const chosen = picked.filter((id) => open.some((row) => row.item_id === id));
  const toggle = (id: string) => setPicked((previous) => (previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]));
  const add = () => {
    if (chosen.length === 0 || addMistakes.isPending) return;
    addMistakes.mutate(
      { sessionId: session.id, data: { item_ids: [...chosen] } },
      {
        onSuccess: () => {
          toast(t("finish.mistakes.done", { n: chosen.length }));
          setPicked([]);
        },
        onError: () => toast(t("finish.mistakes.failed")),
      },
    );
  };
  const estimateText = (row: S04ModuleProgress): string => {
    const low = rankOf(row.estimate?.low);
    const high = rankOf(row.estimate?.high);
    if (low === undefined || high === undefined) return t(`modules.status.${row.status}`);
    const range = low === high ? masteryLabel(low) : t("modules.estimate", { low: masteryLabel(low), high: masteryLabel(high) });
    return row.status === "prior" ? t("modules.estimate_prior", { range }) : range;
  };
  return (
    <Card title={t("finish.title")}>
      <div className="flex flex-col gap-4">
        <p className="text-ink-secondary">
          {session.finish_reason !== undefined && t(`finish.reason.${session.finish_reason}`)}
          {t("finish.summary", { n: session.answered })}
        </p>
        <section aria-label={t("finish.modules")} className="flex flex-col gap-2">
          <h3 className="font-bold text-ink-primary">{t("finish.modules")}</h3>
          <ul className="flex flex-col gap-1">
            {session.modules.map((row) => (
              <li key={row.module_id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{row.name}</span>
                <span className="text-small text-ink-secondary">{estimateText(row)}</span>
              </li>
            ))}
          </ul>
          <ModuleNote modules={session.modules} />
        </section>
        <section aria-label={t("finish.mistakes.title")} className="flex flex-col gap-2">
          <h3 className="font-bold text-ink-primary">{t("finish.mistakes.title")}</h3>
          <p className="text-small text-ink-secondary">{t("finish.mistakes.body")}</p>
          {session.mistakes.length === 0 ? (
            <p className="text-small text-ink-tertiary">{t("finish.mistakes.empty")}</p>
          ) : (
            <ul className="flex flex-col">
              {session.mistakes.map((row, index) => (
                <li key={row.item_id} className={cx("py-3", index > 0 && "border-t border-line-soft")}>
                  <label className={cx("flex items-start gap-2", row.added ? "cursor-default" : "cursor-pointer")}>
                    <input
                      type="checkbox"
                      disabled={row.added}
                      checked={row.added || chosen.includes(row.item_id)}
                      onChange={() => toggle(row.item_id)}
                    />
                    <span className="flex flex-col gap-1">
                      <span className="line-clamp-2 text-ink-primary">{row.stem}</span>
                      <span className="flex flex-wrap items-center gap-2 text-small text-ink-secondary">
                        <Tag size="sm" tone={row.outcome === "wrong" ? "danger" : "neutral"}>
                          {t(`finish.mistakes.outcome.${row.outcome}`)}
                        </Tag>
                        <span>{row.module_name}</span>
                        {row.answer_text !== undefined && <span>{t("finish.mistakes.answer", { answer: row.answer_text })}</span>}
                        {row.added && (
                          <Tag size="sm" tone="success">
                            {t("finish.mistakes.added")}
                          </Tag>
                        )}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {open.length > 0 && (
            <Button className="self-start" busy={addMistakes.isPending} disabled={chosen.length === 0} onClick={add}>
              {t("finish.mistakes.add", { n: chosen.length })}
            </Button>
          )}
        </section>
        <div>
          <Link to={pathTo("S05")} className={buttonClass("primary")}>
            {t("finish.report")}
          </Link>
        </div>
      </div>
    </Card>
  );
}
