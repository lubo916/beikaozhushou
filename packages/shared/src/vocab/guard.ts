// 硬写术语检查（F03）：页面与组件的 TSX 里不直接写状态名、档位名，叫法从词汇常量或 i18n 键取。
// 纯函数：输入源码或文案，输出命中的位置；扫描哪些文件由 packages/ui/scripts/repo-guards.test.ts 决定（pnpm test 运行）。
import { BANNED_COPY, FORBIDDEN_SYNONYMS, VOCAB } from "./glossary.generated.ts";
import { PROPOSAL_STATUS } from "./supplement.ts";

/** 受检的叫法：掌握档、错题状态、页面状态、学习范围、证据强度与提议状态里两个字以上的叫法（单字太常见，不查）。 */
export const GUARDED_TERMS: readonly string[] = [
  ...Object.values(VOCAB.mastery_level),
  ...Object.values(VOCAB.mistake_status),
  ...Object.values(VOCAB.page_state),
  ...Object.values(VOCAB.scope_state),
  ...Object.values(VOCAB.evidence_strength),
  ...Object.values(PROPOSAL_STATUS),
].filter((label, index, all) => label.length >= 2 && all.indexOf(label) === index);

export interface HardcodedTerm {
  readonly line: number;
  readonly term: string;
}

/** 豁免标记：确需在代码里写出叫法的行，在行内写 vocab-exempt: <理由>。 */
export const VOCAB_EXEMPT = "vocab-exempt:";

/** 去掉 // 与 /* *\/ 注释（字符串与 JSX 文本保留），换行原样保留，便于报告行号。 */
export function stripComments(source: string): string {
  let out = "";
  let quote = "";
  let i = 0;
  while (i < source.length) {
    const c = source.charAt(i);
    const next = source.charAt(i + 1);
    if (quote) {
      out += c;
      if (c === "\\") {
        out += next;
        i += 2;
        continue;
      }
      if (c === quote) quote = "";
      i += 1;
    } else if (c === "/" && next === "/") {
      while (i < source.length && source.charAt(i) !== "\n") i += 1;
    } else if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? source.length : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, "");
      i = stop;
    } else {
      if (c === '"' || c === "'" || c === "`") quote = c;
      out += c;
      i += 1;
    }
  }
  return out;
}

/** 找出源码里写死的受检叫法（注释与豁免行不算）。 */
export function findHardcodedTerms(source: string, terms: readonly string[] = GUARDED_TERMS): HardcodedTerm[] {
  const raw = source.split("\n");
  return stripComments(source)
    .split("\n")
    .flatMap((text, index) =>
      raw[index]?.includes(VOCAB_EXEMPT) ? [] : terms.filter((term) => text.includes(term)).map((term) => ({ line: index + 1, term })),
    );
}

export interface ForbiddenWord {
  readonly word: string;
  /** 应改用的叫法；宣传禁用语为 null（直接删掉）。 */
  readonly use: string | null;
}

/** 找出文案里的宣传禁用语与禁用同义词（vocabulary.md 第 11 节、红线 10）。 */
export function findForbiddenWords(text: string): ForbiddenWord[] {
  const banned = BANNED_COPY.filter((word) => text.includes(word)).map((word) => ({ word, use: null }));
  const synonyms = Object.entries(FORBIDDEN_SYNONYMS)
    .filter(([word]) => text.includes(word))
    .map(([word, use]) => ({ word, use }));
  return [...banned, ...synonyms];
}
