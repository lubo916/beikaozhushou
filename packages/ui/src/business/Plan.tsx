import type { ReactNode } from "react";
import { formatDuration } from "@exam-prep/shared/format";
import {
  PROPOSAL_STATUS,
  TODAY_SEGMENT,
  TODAY_SEGMENT_HINT,
  VOCAB,
  type ProposalStatusCode,
  type TaskSourceCode,
  type TodaySegmentCode,
} from "@exam-prep/shared/vocab";
import { Button, IconButton } from "../basic/Button.tsx";
import { Icon } from "../basic/Icon.tsx";
import { Tag } from "../basic/Tag.tsx";
import { COPY } from "../lib/copy.ts";
import { cx } from "../lib/cx.ts";
import { UiLink } from "../lib/link.tsx";
import { AiBadge, ReasonTags } from "./Ai.tsx";

export interface ProposalCardProps {
  title?: ReactNode;
  /** 固定四行：改什么、为什么、代价、不改会怎样。 */
  what: ReactNode;
  why: ReactNode;
  cost: ReactNode;
  ifNot: ReactNode;
  status: ProposalStatusCode;
  onConfirm?: (() => void) | undefined;
  onDecline?: (() => void) | undefined;
  onUndo?: (() => void) | undefined;
  /** 撤销期限（页面用参数插值，如“{{days}} 天内可撤销”）。 */
  undoHint?: ReactNode;
  /** AI 提出的提议带 AI 标识。 */
  aiGenerated?: boolean | undefined;
  busy?: boolean | undefined;
  className?: string | undefined;
}

const PROPOSAL_TONE = { pending: "warning", confirmed: "success", declined: "neutral", undone: "neutral" } as const;

/** 提议卡：AI 或系统对计划、范围、目标、轮次的修改建议，只有“确认”和“不改”；确认后在期限内可撤销。 */
export function ProposalCard(props: ProposalCardProps) {
  const {
    title = COPY.proposal.title,
    what,
    why,
    cost,
    ifNot,
    status,
    onConfirm,
    onDecline,
    onUndo,
    undoHint,
    aiGenerated = false,
    busy = false,
    className,
  } = props;
  const rows = [
    { key: "what", label: COPY.proposal.what, value: what },
    { key: "why", label: COPY.proposal.why, value: why },
    { key: "cost", label: COPY.proposal.cost, value: cost },
    { key: "ifNot", label: COPY.proposal.if_not, value: ifNot },
  ];
  return (
    <article className={cx("ui-proposal", `ui-proposal--${status}`, className)}>
      <header className="ui-proposal__head">
        <h3 className="ui-proposal__title">{title}</h3>
        <span className="ui-proposal__badges">
          {aiGenerated && <AiBadge />}
          <Tag tone={PROPOSAL_TONE[status]}>{PROPOSAL_STATUS[status]}</Tag>
        </span>
      </header>
      <dl className="ui-proposal__rows">
        {rows.map((row) => (
          <div key={row.key} className="ui-proposal__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {status === "pending" && (
        <div className="ui-proposal__actions">
          <Button variant="primary" busy={busy} onClick={onConfirm}>
            {COPY.action.confirm}
          </Button>
          <Button disabled={busy} onClick={onDecline}>
            {COPY.action.decline}
          </Button>
        </div>
      )}
      {status === "confirmed" && onUndo !== undefined && (
        <div className="ui-proposal__actions">
          <Button size="sm" busy={busy} onClick={onUndo}>
            {COPY.action.undo}
          </Button>
          {undoHint !== undefined && <span className="ui-proposal__hint">{undoHint}</span>}
        </div>
      )}
    </article>
  );
}

export interface UndoBarProps {
  /** 发生了什么（如“已把 2 项顺延到明天”，数字来自接口）。 */
  message: ReactNode;
  /** 撤销期限（页面用参数插值）。 */
  hint?: ReactNode;
  onUndo: () => void;
  onDismiss?: (() => void) | undefined;
  busy?: boolean | undefined;
  className?: string | undefined;
}

/** 撤销条：自动顺延等可撤销的改动，次日告知并给“撤销”。 */
export function UndoBar({ message, hint, onUndo, onDismiss, busy = false, className }: UndoBarProps) {
  return (
    <div role="status" className={cx("ui-undo", className)}>
      <span className="ui-undo__icon" aria-hidden="true">
        <Icon name="undo" />
      </span>
      <span className="ui-undo__text">
        <span>{message}</span>
        {hint !== undefined && <span className="ui-undo__hint">{hint}</span>}
      </span>
      <Button size="sm" busy={busy} onClick={onUndo}>
        {COPY.action.undo}
      </Button>
      {onDismiss !== undefined && <IconButton label={COPY.action.dismiss} icon="close" onClick={onDismiss} />}
    </div>
  );
}

export type TaskState = "todo" | "doing" | "done" | "seen";

export interface TaskStripProps {
  source: TaskSourceCode;
  /** 所在的段（接口返回）；决定左侧色条。 */
  segment?: TodaySegmentCode | undefined;
  title: ReactNode;
  /** 估计用时（分钟，接口返回）。 */
  minutes: number;
  reasons?: readonly ReactNode[] | undefined;
  aiPolished?: boolean | undefined;
  /** done＝有证据的完成；seen＝手动勾选只记“看过”。 */
  state?: TaskState | undefined;
  /** 直达具体位置的地址，或开始的回调。 */
  href?: string | undefined;
  onStart?: (() => void) | undefined;
  startLabel?: string | undefined;
  className?: string | undefined;
}

/** 今日任务条：来源、标题、理由、用时与“开始”。 */
export function TaskStrip(props: TaskStripProps) {
  const {
    source,
    segment,
    title,
    minutes,
    reasons = [],
    aiPolished = false,
    state = "todo",
    href,
    onStart,
    startLabel = COPY.action.start,
    className,
  } = props;
  const finished = state === "done" || state === "seen";
  return (
    <li className={cx("ui-task", segment !== undefined && `ui-task--${segment}`, `ui-task--${state}`, className)}>
      <span className="ui-task__seg" aria-hidden="true" />
      <div className="ui-task__main">
        <div className="ui-task__top">
          <Tag size="sm">{VOCAB.task_source[source]}</Tag>
          {href !== undefined && !finished ? (
            <UiLink href={href} className="ui-task__title">
              {title}
            </UiLink>
          ) : (
            <span className="ui-task__title">{title}</span>
          )}
        </div>
        <ReasonTags reasons={reasons} aiPolished={aiPolished} />
      </div>
      <div className="ui-task__side">
        <span className="ui-task__time">{formatDuration(minutes)}</span>
        {finished ? (
          <span className="ui-task__state">
            {state === "done" && <Icon name="check" />}
            {state === "done" ? COPY.task.done : COPY.task.seen}
          </span>
        ) : (
          onStart !== undefined && (
            <Button size="sm" variant={state === "doing" ? "primary" : "secondary"} onClick={onStart}>
              {startLabel}
            </Button>
          )
        )}
      </div>
    </li>
  );
}

export interface TaskGroupProps {
  segment: TodaySegmentCode;
  children: ReactNode;
  /** 段名旁的补充（如本段合计用时）。 */
  meta?: ReactNode;
  className?: string | undefined;
}

/** 今日清单的一段（巩固、推进、收尾）：段名、说明与任务条列表。 */
export function TaskGroup({ segment, children, meta, className }: TaskGroupProps) {
  return (
    <section className={cx("ui-taskgroup", `ui-taskgroup--${segment}`, className)} aria-label={TODAY_SEGMENT[segment]}>
      <header className="ui-taskgroup__head">
        <h3 className="ui-taskgroup__title">{TODAY_SEGMENT[segment]}</h3>
        <span className="ui-taskgroup__hint">{TODAY_SEGMENT_HINT[segment]}</span>
        {meta !== undefined && <span className="ui-taskgroup__meta">{meta}</span>}
      </header>
      <ul className="ui-list ui-list--divided">{children}</ul>
    </section>
  );
}
