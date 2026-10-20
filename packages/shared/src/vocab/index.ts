// 词汇常量（F03）：叫法与代码标识由 docs/product/glossary.yaml 生成（glossary.generated.ts，改术语表后运行 node tools/gen-vocab.ts）；
// 术语表还没收的叫法临时放在 supplement.ts。界面文字引用这里的常量或 i18n 键，不手写同义词；页面里硬写状态名、档位名会被检查拦下（guard.ts）。
import { RANK, SCALE, VOCAB } from "./glossary.generated.ts";
import { CREDIBILITY_SHORT } from "./supplement.ts";

export { BANNED_COPY, FORBIDDEN_SYNONYMS, RANK, SCALE, TERM, VOCAB } from "./glossary.generated.ts";
export * from "./supplement.ts";
export { GUARDED_TERMS, VOCAB_EXEMPT, findForbiddenWords, findHardcodedTerms, stripComments } from "./guard.ts";
export type { ForbiddenWord, HardcodedTerm } from "./guard.ts";

export type VocabCode = keyof typeof VOCAB;
export type VocabValue<K extends VocabCode> = keyof (typeof VOCAB)[K] & string;

/** 枚举取值的界面叫法；未登记的取值原样返回（便于发现漏登记）。 */
export function vocabLabel<K extends VocabCode>(term: K, value: VocabValue<K>): string {
  const labels: Readonly<Record<string, string>> = VOCAB[term];
  return labels[value] ?? value;
}

export type MasteryCode = VocabValue<"mastery_level">;
/** 掌握档序号：0 未学 … 5 能迁移。 */
export type MasteryRank = 0 | 1 | 2 | 3 | 4 | 5;

const masteryEntries = (Object.entries(RANK.mastery_level) as [MasteryCode, MasteryRank][]).sort((a, b) => a[1] - b[1]);

/** 掌握六档的代码，按序号从低到高。 */
export const MASTERY_CODES: readonly MasteryCode[] = masteryEntries.map(([code]) => code);
/** 掌握六档的序号，从低到高。 */
export const MASTERY_RANKS: readonly MasteryRank[] = masteryEntries.map(([, rank]) => rank);

export function masteryCode(rank: MasteryRank): MasteryCode {
  const found = masteryEntries.find(([, value]) => value === rank);
  if (!found) throw new RangeError(`掌握档序号超出范围：${rank}`);
  return found[0];
}

export function masteryLabel(rank: MasteryRank): string {
  return VOCAB.mastery_level[masteryCode(rank)];
}

export type PageStateCode = VocabValue<"page_state">;
/** 页面状态代码（七态加锁定），也是 ?state= 的取值。 */
export const PAGE_STATE_CODES = Object.keys(VOCAB.page_state) as readonly PageStateCode[];

export type MistakeStatusCode = VocabValue<"mistake_status">;
export type EvidenceStrengthCode = VocabValue<"evidence_strength">;
export type ConfidenceCode = VocabValue<"confidence">;
export type CredibilityCode = VocabValue<"question_credibility">;
export type KnowledgeTypeCode = VocabValue<"knowledge_type">;
export type TaskSourceCode = VocabValue<"task_source">;
export type ScopeStateCode = VocabValue<"scope_state">;
export type ThreeNumberCode = VocabValue<"three_numbers">;

/** 重要度刻度（1–4 级，4 最重要）。 */
export const IMPORTANCE_LEVELS: readonly number[] = SCALE.importance.map(Number);

const CHINESE_ORDINAL = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;

/** 题目可信度的界面写法“几级＋简称”，如“一级 审定”。 */
export function credibilityLabel(code: CredibilityCode): string {
  return `${CHINESE_ORDINAL[RANK.question_credibility[code]] ?? ""}级 ${CREDIBILITY_SHORT[code]}`;
}
