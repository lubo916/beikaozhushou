import { useRef, type KeyboardEvent } from "react";
import { formatTierGap } from "@exam-prep/shared/format";
import { MASTERY_RANKS, masteryLabel, type MasteryRank } from "@exam-prep/shared/vocab";
import { Segmented } from "../basic/Choice.tsx";
import { COPY, fill } from "../lib/copy.ts";
import { cx } from "../lib/cx.ts";
import { nextIndex } from "../lib/roving.ts";

export interface MasteryLadderProps {
  /** 系统判定（接口返回）。 */
  system: MasteryRank;
  /** 目标档。 */
  target: MasteryRank;
  /** 档位差（接口返回，页面不重算）：≤ 0 显示“已达标”，否则“还差 N 档”。 */
  gap: number;
  /** 自评；没有就不传。 */
  self?: MasteryRank | undefined;
  /** 自评“已掌握”还在等检验题。 */
  selfPending?: boolean | undefined;
  /** 系统判定的证据是否充足；不足时画虚线，读屏念“证据不足，不等于不会”。 */
  evidenceSufficient?: boolean | undefined;
  variant?: "full" | "mini" | undefined;
  /** 能改目标档时传入（完整版下方出现“改目标档”）。 */
  onTargetChange?: ((rank: MasteryRank) => void) | undefined;
  className?: string | undefined;
}

/** 掌握阶梯：同时标出系统判定、自评与目标档，显示还差几档（S10-01）。完整版用于知识点主页，迷你版用于小卡与列表。 */
export function MasteryLadder(props: MasteryLadderProps) {
  const { system, target, gap, self, selfPending = false, evidenceSufficient = true, variant = "full", onTargetChange, className } = props;
  const gapText = formatTierGap(gap);
  const summary = fill(COPY.ladder.summary, {
    system: COPY.ladder.system,
    systemLabel: masteryLabel(system),
    target: COPY.ladder.target,
    targetLabel: masteryLabel(target),
    gap: gapText,
  });
  if (variant === "mini") {
    return (
      <span className={cx("ui-ladder-mini", !evidenceSufficient && "ui-ladder-mini--uncertain", className)}>
        <span
          className="ui-ladder-mini__track"
          role="img"
          aria-label={evidenceSufficient ? summary : `${summary}；${COPY.ladder.uncertain}`}
        >
          {MASTERY_RANKS.map((rank) => (
            <span
              key={rank}
              className={cx(
                "ui-ladder-mini__seg",
                `ui-m-${system}`,
                rank <= system && "ui-ladder-mini__seg--on",
                rank === target && "ui-ladder-mini__seg--target",
              )}
            />
          ))}
        </span>
        <span className="ui-ladder-mini__label" aria-hidden="true">
          {masteryLabel(system)}
        </span>
      </span>
    );
  }
  return (
    <div className={cx("ui-ladder", !evidenceSufficient && "ui-ladder--uncertain", className)}>
      <p className="ui-ladder__summary">
        <span className={cx("ui-ladder__gap", gap <= 0 && "ui-ladder__gap--met")}>{gapText}</span>
        {!evidenceSufficient && <span className="ui-ladder__note">{COPY.ladder.uncertain}</span>}
        {selfPending && <span className="ui-ladder__note">{COPY.ladder.self_pending}</span>}
      </p>
      <ol className="ui-ladder__steps">
        {MASTERY_RANKS.map((rank) => (
          <li
            key={rank}
            data-rank={rank}
            className={cx(
              "ui-ladder__step",
              `ui-m-${rank}`,
              rank <= system && "ui-ladder__step--reached",
              rank === system && "ui-ladder__step--system",
              rank === target && "ui-ladder__step--target",
            )}
          >
            <span className="ui-ladder__marks">
              {rank === system && <span className="ui-ladder__mark ui-ladder__mark--system">{COPY.ladder.system}</span>}
              {rank === self && <span className="ui-ladder__mark ui-ladder__mark--self">{COPY.ladder.self}</span>}
              {rank === target && <span className="ui-ladder__mark ui-ladder__mark--target">{COPY.ladder.target}</span>}
            </span>
            <span className="ui-ladder__bar" aria-hidden="true" />
            <span className="ui-ladder__label">{masteryLabel(rank)}</span>
          </li>
        ))}
      </ol>
      {onTargetChange !== undefined && (
        <Segmented
          size="sm"
          label={COPY.ladder.change_target}
          value={String(target)}
          options={MASTERY_RANKS.map((rank) => ({ value: String(rank), label: masteryLabel(rank) }))}
          onChange={(value) => onTargetChange(Number(value) as MasteryRank)}
        />
      )}
    </div>
  );
}

export interface MasteryCell {
  id: string;
  name: string;
  level: MasteryRank;
  /** 证据不足：画虚线格（不等于不会）。 */
  evidenceSufficient?: boolean | undefined;
  /** 不在学习范围：画斜纹格。 */
  inScope?: boolean | undefined;
}

export interface MasteryGridProps {
  /** 这组方格的名称（读屏用）。 */
  label: string;
  cells: readonly MasteryCell[];
  /** 点格子（跳到知识点主页等）；不传则格子只读。 */
  onSelect?: ((id: string) => void) | undefined;
  showLegend?: boolean | undefined;
  className?: string | undefined;
}

function cellText(cell: MasteryCell): string {
  if (cell.inScope === false) return `${cell.name}：${COPY.grid.out_of_scope}`;
  if (cell.evidenceSufficient === false) return `${cell.name}：${COPY.grid.uncertain}`;
  return `${cell.name}：${masteryLabel(cell.level)}`;
}

function cellClass(cell: MasteryCell): string {
  return cx(
    "ui-grid__cell",
    `ui-m-${cell.level}`,
    cell.evidenceSufficient === false && "ui-grid__cell--uncertain",
    cell.inScope === false && "ui-grid__cell--out",
  );
}

/** 掌握方格：每格一个知识点，颜色是掌握档；可点时方向键在格子间移动。 */
export function MasteryGrid({ label, cells, onSelect, showLegend = true, className }: MasteryGridProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextIndex(cells, index, event.key);
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
  }
  return (
    <div className={cx("ui-grid", className)}>
      <div role="group" aria-label={label} className="ui-grid__cells">
        {cells.map((cell, index) =>
          onSelect !== undefined ? (
            <button
              key={cell.id}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              className={cellClass(cell)}
              aria-label={cellText(cell)}
              title={cellText(cell)}
              tabIndex={index === 0 ? 0 : -1}
              onClick={() => onSelect(cell.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            />
          ) : (
            <span key={cell.id} role="img" className={cellClass(cell)} aria-label={cellText(cell)} title={cellText(cell)} />
          ),
        )}
      </div>
      {showLegend && (
        <ul className="ui-legend" aria-label={COPY.grid.legend}>
          {MASTERY_RANKS.map((rank) => (
            <li key={rank} className="ui-legend__item">
              <span className={cx("ui-legend__swatch", `ui-m-${rank}`)} aria-hidden="true" />
              {masteryLabel(rank)}
            </li>
          ))}
          <li className="ui-legend__item">
            <span className="ui-legend__swatch ui-grid__cell--uncertain" aria-hidden="true" />
            {COPY.grid.uncertain}
          </li>
          <li className="ui-legend__item">
            <span className="ui-legend__swatch ui-grid__cell--out" aria-hidden="true" />
            {COPY.grid.out_of_scope}
          </li>
        </ul>
      )}
    </div>
  );
}
