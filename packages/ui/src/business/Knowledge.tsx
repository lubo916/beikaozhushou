import type { ReactNode } from "react";
import {
  IMPORTANCE_LEVELS,
  VOCAB,
  credibilityLabel,
  type ConfidenceCode,
  type CredibilityCode,
  type EvidenceStrengthCode,
  type KnowledgeTypeCode,
  type MasteryRank,
  type ScopeStateCode,
} from "@exam-prep/shared/vocab";
import { Icon } from "../basic/Icon.tsx";
import { Tag, type TagTone } from "../basic/Tag.tsx";
import { COPY, fill } from "../lib/copy.ts";
import { cx } from "../lib/cx.ts";
import { UiLink } from "../lib/link.tsx";
import { ReasonTags } from "./Ai.tsx";
import { MasteryLadder } from "./Mastery.tsx";

/** 重要度星级（1–4 级，4 最重要）：读屏念“重要度 3 级（共 4 级）”。 */
export function Importance({ level, className }: { level: number; className?: string | undefined }) {
  const max = IMPORTANCE_LEVELS.length;
  return (
    <span className={cx("ui-stars", className)} role="img" aria-label={fill(COPY.kp.importance, { level, max })}>
      {IMPORTANCE_LEVELS.map((value) => (
        <span key={value} className={value <= level ? "ui-stars__on" : "ui-stars__off"} aria-hidden="true">
          <Icon name="star" filled={value <= level} />
        </span>
      ))}
    </span>
  );
}

export interface KpCardProps {
  name: string;
  /** 所属（章 › 节）。 */
  path?: ReactNode;
  system: MasteryRank;
  target: MasteryRank;
  /** 档位差（接口返回）。 */
  gap: number;
  evidenceSufficient?: boolean | undefined;
  importance?: number | undefined;
  types?: readonly KnowledgeTypeCode[] | undefined;
  /** 学习范围：跟随默认时不显示标签。 */
  scope?: ScopeStateCode | undefined;
  starred?: boolean | undefined;
  reasons?: readonly ReactNode[] | undefined;
  href?: string | undefined;
  onSelect?: (() => void) | undefined;
  action?: ReactNode;
  className?: string | undefined;
}

/** 知识点小卡：名称、所属、迷你阶梯、属性标签与理由。 */
export function KpCard(props: KpCardProps) {
  const {
    name,
    path,
    system,
    target,
    gap,
    evidenceSufficient,
    importance,
    types = [],
    scope,
    starred = false,
    reasons = [],
    href,
    onSelect,
    action,
    className,
  } = props;
  let title: ReactNode = <span className="ui-kp__name">{name}</span>;
  if (href !== undefined) {
    title = (
      <UiLink href={href} className="ui-kp__name">
        {name}
      </UiLink>
    );
  } else if (onSelect !== undefined) {
    title = (
      <button type="button" className="ui-kp__name" onClick={onSelect}>
        {name}
      </button>
    );
  }
  return (
    <article className={cx("ui-kp", className)}>
      <header className="ui-kp__head">
        <div className="ui-kp__titles">
          <h3 className="ui-kp__title">{title}</h3>
          {path !== undefined && <p className="ui-kp__path">{path}</p>}
        </div>
        {action}
      </header>
      <div className="ui-kp__row">
        <MasteryLadder variant="mini" system={system} target={target} gap={gap} evidenceSufficient={evidenceSufficient} />
        {importance !== undefined && <Importance level={importance} />}
      </div>
      {(types.length > 0 || (scope !== undefined && scope !== "default") || starred) && (
        <div className="ui-kp__tags">
          {types.map((type) => (
            <Tag key={type} size="sm" tone="outline">
              {VOCAB.knowledge_type[type]}
            </Tag>
          ))}
          {scope !== undefined && scope !== "default" && (
            <Tag size="sm" tone={scope === "removed" ? "neutral" : "brand"}>
              {VOCAB.scope_state[scope]}
            </Tag>
          )}
          {starred && (
            <Tag size="sm" tone="warning" icon={<Icon name="star" filled />}>
              {COPY.kp.starred}
            </Tag>
          )}
        </div>
      )}
      <ReasonTags reasons={reasons} />
    </article>
  );
}

const STRENGTH_TONE: Record<EvidenceStrengthCode, TagTone> = {
  strong: "success",
  medium: "brand",
  weak: "neutral",
  negative: "danger",
  pending: "warning",
};

export interface EvidenceRowProps {
  /** 何时（已格式化，如“10月20日 14:05”）。 */
  when: ReactNode;
  /** 做了什么（题目或卡片）。 */
  title: ReactNode;
  /** 作答、回忆、检验题等（页面传入）。 */
  kind?: ReactNode;
  result: "correct" | "wrong" | "partial";
  confidence?: ConfidenceCode | undefined;
  /** 用时（已格式化）。 */
  duration?: ReactNode;
  strength: EvidenceStrengthCode;
  credibility?: CredibilityCode | undefined;
  /** 补充说明（如“秒答，换个问法再考”）。 */
  note?: ReactNode;
  className?: string | undefined;
}

/** 证据行：一条掌握证据（S10-06），放在 List 里用。 */
export function EvidenceRow({ when, title, kind, result, confidence, duration, strength, credibility, note, className }: EvidenceRowProps) {
  return (
    <li className={cx("ui-evi", className)}>
      <div className="ui-evi__main">
        <span className="ui-evi__title">{title}</span>
        <span className="ui-evi__meta">
          <span>{when}</span>
          {kind !== undefined && <span>{kind}</span>}
          {confidence !== undefined && <span>{VOCAB.confidence[confidence]}</span>}
          {duration !== undefined && <span>{duration}</span>}
          {credibility !== undefined && <span>{credibilityLabel(credibility)}</span>}
        </span>
      </div>
      <div className="ui-evi__side">
        <span className={`ui-evi__result ui-evi__result--${result}`}>{COPY.evidence[result]}</span>
        <Tag size="sm" tone={STRENGTH_TONE[strength]}>
          {VOCAB.evidence_strength[strength]}
        </Tag>
      </div>
      {note !== undefined && <p className="ui-evi__note">{note}</p>}
    </li>
  );
}
