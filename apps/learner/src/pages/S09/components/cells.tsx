// 掌握方格（feat:S09-01 方格全景、S09-02 六种着色、S09-04 虚线格与斜纹格、S09-19 章节折叠）：几百个格子在一个组件里画，
// 所有格子共用同一个点击与方向键处理函数（不为每格新建函数），没变的属性不重画（memo）。颜色只用令牌（S09.css），
// 格里另有数字或字，读屏念出名称与取值，颜色不是唯一信息（ui-rules 第 12 节）。
import { memo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { S09Chapter, S09MaterialCoverage, S09Point, S09RoiTier } from "@exam-prep/contract";
import { formatCount, formatTierGap } from "@exam-prep/shared/format";
import { IMPORTANCE_LEVELS, MASTERY_RANKS, VOCAB, masteryLabel } from "@exam-prep/shared/vocab";
import { ProgressBar } from "@exam-prep/ui";
import { toRank, toggled, type Coloring } from "../data.ts";

/** 掌握档从这一档起底色较深，格里的字用浅色。 */
const LIGHT_TEXT_FROM = 3;
const ROI_TIERS = Object.keys(VOCAB.roi_tier) as S09RoiTier[];
const RISKS = ["high", "medium", "low"] as const;
const MATERIALS: readonly S09MaterialCoverage[] = ["readable", "mapped", "none"];
const MATERIAL_TONE: Readonly<Record<S09MaterialCoverage, string>> = {
  readable: "s09-cell--good",
  mapped: "s09-cell--soft",
  none: "s09-cell--warn",
};

export interface CellLook {
  /** 着色用的样式类。 */
  readonly tone: string;
  /** 格里的数字或字。 */
  readonly marker: string;
  /** 读屏与悬停提示念的取值。 */
  readonly text: string;
}

const masteryTone = (level: number): string => `s09-cell--m ui-m-${toRank(level)}${level >= LIGHT_TEXT_FROM ? " s09-cell--light" : ""}`;

/** 一格在某种着色下的样子：只按接口给的值选颜色与文字。 */
function useLook(coloring: Coloring, locked: boolean): (point: S09Point) => CellLook {
  const { t } = useTranslation("S09");
  return (point) => {
    let base = masteryLabel(toRank(point.level));
    if (!point.in_scope) base = t("grid.cell_out");
    else if (!point.evidence_sufficient) base = t("grid.cell_uncertain");
    else if (point.pending_verification) base = t("grid.and", { a: base, b: t("grid.cell_pending") });
    const and = (text: string): string => t("grid.and", { a: text, b: base });
    if (!point.in_scope) return { tone: "s09-cell--out", marker: "", text: base };
    switch (coloring) {
      case "mastery":
        if (!point.evidence_sufficient) return { tone: "s09-cell--uncertain", marker: "", text: base };
        return { tone: masteryTone(point.level), marker: point.level > 0 ? String(point.level) : "", text: base };
      case "target": {
        if (point.gap === undefined) return { tone: "s09-cell--none", marker: "", text: and(t("legend.target_none")) };
        const gap = formatTierGap(point.gap);
        if (!point.evidence_sufficient) return { tone: "s09-cell--uncertain", marker: "", text: and(gap) };
        if (point.reached) return { tone: "s09-cell--good", marker: t("marker.met"), text: and(gap) };
        return { tone: "s09-cell--warn", marker: point.gap > 0 ? String(point.gap) : "", text: and(gap) };
      }
      case "frequency":
        if (point.exam_level === undefined) return { tone: "s09-cell--none", marker: "", text: and(t("legend.frequency_none")) };
        return {
          tone: `s09-cell--f${point.exam_level}`,
          marker: String(point.exam_level),
          text: and(t("legend.frequency_level", { level: point.exam_level })),
        };
      case "forgetting":
        if (point.forgetting_risk === undefined) return { tone: "s09-cell--none", marker: "", text: and(t("legend.forgetting_none")) };
        return {
          tone: `s09-cell--risk-${point.forgetting_risk}`,
          marker: t(`marker.${point.forgetting_risk}`),
          text: and(t(`legend.forgetting_${point.forgetting_risk}`)),
        };
      case "roi":
        if (locked) return { tone: "s09-cell--locked", marker: "", text: and(t("legend.roi_locked")) };
        if (point.roi_tier === undefined) return { tone: "s09-cell--none", marker: "", text: and(t("legend.roi_none")) };
        return {
          tone: `s09-cell--roi-${point.roi_tier}`,
          marker: VOCAB.roi_tier[point.roi_tier],
          text: and(t("legend.roi_tier", { tier: VOCAB.roi_tier[point.roi_tier] })),
        };
      case "material":
        return {
          tone: MATERIAL_TONE[point.material],
          marker: t(`marker.${point.material}`),
          text: and(t(`legend.material_${point.material}`)),
        };
    }
  };
}

/** 方向键要找的下一格：左右在同一章里走，上下跳到相邻的展开的章、同一列（不够长就停在末格），Home、End 到本章首尾。 */
function nextCell(root: HTMLElement, row: number, col: number, key: string): HTMLButtonElement | null {
  const rowCells = (r: number): HTMLButtonElement[] => [...root.querySelectorAll<HTMLButtonElement>(`button[data-row="${r}"]`)];
  const here = rowCells(row);
  if (key === "ArrowRight") return here[col + 1] ?? null;
  if (key === "ArrowLeft") return here[col - 1] ?? null;
  if (key === "Home") return here[0] ?? null;
  if (key === "End") return here[here.length - 1] ?? null;
  if (key !== "ArrowDown" && key !== "ArrowUp") return null;
  const step = key === "ArrowDown" ? 1 : -1;
  const rows = Number(root.dataset["rows"]);
  for (let r = row + step; r >= 0 && r < rows; r += step) {
    const cells = rowCells(r);
    if (cells.length > 0) return cells[Math.min(col, cells.length - 1)] ?? null;
  }
  return null;
}

export interface MapGridProps {
  readonly chapters: readonly S09Chapter[];
  readonly coloring: Coloring;
  readonly locked: boolean;
  /** 符合筛选的知识点；没在筛选时不传。不符合的格子变淡，不挪位置。 */
  readonly matched: ReadonlySet<string> | undefined;
  readonly selectedId: string | undefined;
  readonly onSelect: (id: string) => void;
}

export const MapGrid = memo(function MapGrid({ chapters, coloring, locked, matched, selectedId, onSelect }: MapGridProps) {
  const { t } = useTranslation("S09");
  const look = useLook(coloring, locked);
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set(chapters.filter((c) => c.collapsed_by_default).map((c) => c.id)));
  const [roving, setRoving] = useState<string | undefined>(undefined);
  const firstId = chapters.find((chapter) => !folded.has(chapter.id))?.points[0]?.id;
  const tabStop = roving ?? selectedId ?? firstId;

  const onCell = (event: MouseEvent<HTMLButtonElement>): void => {
    const id = event.currentTarget.dataset["point"];
    if (id === undefined) return;
    setRoving(id);
    onSelect(id);
  };
  const onKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const root = event.currentTarget.closest<HTMLElement>(".s09-grid");
    if (root === null) return;
    const target = nextCell(root, Number(event.currentTarget.dataset["row"]), Number(event.currentTarget.dataset["col"]), event.key);
    if (target === null) return;
    event.preventDefault();
    target.focus();
    setRoving(target.dataset["point"]);
  };

  return (
    <div className="s09-grid" data-rows={chapters.length}>
      {chapters.map((chapter, row) => {
        const isFolded = folded.has(chapter.id);
        const counts = { reached: formatCount(chapter.reached), total: formatCount(chapter.total) };
        return (
          <div key={chapter.id} role="group" aria-label={t("grid.label", { chapter: chapter.name, ...counts })} className="s09-row">
            <button
              type="button"
              className="s09-row__name"
              aria-expanded={!isFolded}
              title={isFolded ? t("grid.unfold") : t("grid.fold")}
              onClick={() => setFolded((prev) => toggled(prev, chapter.id))}
            >
              {chapter.name}
            </button>
            {isFolded ? (
              <ProgressBar className="s09-row__bar" value={chapter.reached_ratio} label={chapter.name} showLabel={false} size="sm" tone="success" />
            ) : (
              <div className="s09-cells">
                {chapter.points.map((point, col) => {
                  const shown = look(point);
                  const dim = matched !== undefined && !matched.has(point.id);
                  const text = dim ? t("grid.and", { a: shown.text, b: t("grid.cell_dim") }) : shown.text;
                  const label = t("grid.cell", { name: point.name, text });
                  return (
                    <button
                      key={point.id}
                      type="button"
                      data-point={point.id}
                      data-row={row}
                      data-col={col}
                      tabIndex={point.id === tabStop ? 0 : -1}
                      aria-pressed={point.id === selectedId}
                      aria-label={label}
                      title={label}
                      className={`s09-cell ${shown.tone}${dim ? " s09-cell--dim" : ""}`}
                      onClick={onCell}
                      onKeyDown={onKey}
                    >
                      {shown.marker}
                    </button>
                  );
                })}
              </div>
            )}
            <span className="s09-row__count" aria-hidden="true">
              {t("grid.count", counts)}
            </span>
          </div>
        );
      })}
    </div>
  );
});

interface LegendItem {
  readonly key: string;
  readonly tone: string;
  readonly marker: string;
  readonly label: string;
}

/** 图例：跟着当前着色换；范围外（斜纹）一直在，掌握档与目标达成另有证据不足（虚线）。 */
export function Legend({ coloring, locked }: { readonly coloring: Coloring; readonly locked: boolean }) {
  const { t } = useTranslation("S09");
  const uncertain: LegendItem = { key: "uncertain", tone: "s09-cell--uncertain", marker: "", label: t("legend.uncertain") };
  const out: LegendItem = { key: "out", tone: "s09-cell--out", marker: "", label: t("legend.out") };
  const none = (label: string): LegendItem => ({ key: "none", tone: "s09-cell--none", marker: "", label });
  let items: LegendItem[];
  switch (coloring) {
    case "mastery":
      items = [
        ...MASTERY_RANKS.map((rank) => ({ key: `m${rank}`, tone: masteryTone(rank), marker: "", label: `${rank} ${masteryLabel(rank)}` })),
        uncertain,
        out,
      ];
      break;
    case "target":
      items = [
        { key: "met", tone: "s09-cell--good", marker: t("marker.met"), label: formatTierGap(0) },
        { key: "gap", tone: "s09-cell--warn", marker: "", label: t("legend.target_gap") },
        none(t("legend.target_none")),
        uncertain,
        out,
      ];
      break;
    case "frequency":
      items = [
        ...IMPORTANCE_LEVELS.map((level) => ({ key: `f${level}`, tone: `s09-cell--f${level}`, marker: String(level), label: t("legend.frequency_level", { level }) })),
        none(t("legend.frequency_none")),
        out,
      ];
      break;
    case "forgetting":
      items = [
        ...RISKS.map((risk) => ({ key: risk, tone: `s09-cell--risk-${risk}`, marker: t(`marker.${risk}`), label: t(`legend.forgetting_${risk}`) })),
        none(t("legend.forgetting_none")),
        out,
      ];
      break;
    case "roi":
      items = locked
        ? [{ key: "locked", tone: "s09-cell--locked", marker: "", label: t("legend.roi_locked") }, out]
        : [
            ...ROI_TIERS.map((tier) => ({
              key: tier,
              tone: `s09-cell--roi-${tier}`,
              marker: VOCAB.roi_tier[tier],
              label: t("legend.roi_tier", { tier: VOCAB.roi_tier[tier] }),
            })),
            none(t("legend.roi_none")),
            out,
          ];
      break;
    case "material":
      items = [
        ...MATERIALS.map((material) => ({
          key: material,
          tone: MATERIAL_TONE[material],
          marker: t(`marker.${material}`),
          label: t(`legend.material_${material}`),
        })),
        out,
      ];
      break;
  }
  return (
    <ul className="s09-legend" aria-label={t("legend.label")}>
      {items.map((item) => (
        <li key={item.key}>
          <span className={`s09-cell s09-swatch ${item.tone}`} aria-hidden="true">
            {item.marker}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
