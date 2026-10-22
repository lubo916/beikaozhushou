// 大纲树视图（feat:S09-18 手机默认大纲树）：每章一行的达标进度，点章名展开这一章的知识点（链到知识点主页）。
// 达标数与比例由接口给，页面只显示。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S09Chapter, S09Point } from "@exam-prep/contract";
import { formatCount, formatTierGap } from "@exam-prep/shared/format";
import { masteryLabel } from "@exam-prep/shared/vocab";
import { ProgressBar } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";
import { toRank, toggled } from "../data.ts";

export function TreeView({ chapters }: { readonly chapters: readonly S09Chapter[] }) {
  const { t } = useTranslation("S09");
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const status = (point: S09Point): string => {
    if (!point.in_scope) return t("tree.out");
    if (!point.evidence_sufficient) return t("tree.uncertain");
    const level = masteryLabel(toRank(point.level));
    return point.gap === undefined ? level : t("tree.status", { level, gap: formatTierGap(point.gap) });
  };
  return (
    <ul className="s09-tree" aria-label={t("tree.label")}>
      {chapters.map((chapter) => {
        const expanded = open.has(chapter.id);
        const counts = { reached: formatCount(chapter.reached), total: formatCount(chapter.total) };
        return (
          <li key={chapter.id}>
            <div className="s09-tree__row">
              <button type="button" className="s09-tree__toggle" aria-expanded={expanded} onClick={() => setOpen((prev) => toggled(prev, chapter.id))}>
                {chapter.name}
              </button>
              <ProgressBar
                value={chapter.reached_ratio}
                label={t("grid.label", { chapter: chapter.name, ...counts })}
                showLabel={false}
                size="sm"
                className="s09-tree__bar"
              />
              <span className="s09-tree__count">{t("tree.row", counts)}</span>
            </div>
            {expanded && (
              <ul className="s09-tree__points">
                {chapter.points.map((point) => (
                  <li key={point.id} className="s09-tree__point">
                    <Link to={pathTo("S10", { kpId: point.id })}>{point.name}</Link>
                    <span className="s09-note">{status(point)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
