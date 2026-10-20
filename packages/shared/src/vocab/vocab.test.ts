import { describe, expect, it } from "vitest";
import {
  GUARDED_TERMS,
  IMPORTANCE_LEVELS,
  MASTERY_CODES,
  MASTERY_RANKS,
  PAGE_STATE_CODES,
  TERM,
  VOCAB,
  credibilityLabel,
  findForbiddenWords,
  findHardcodedTerms,
  masteryCode,
  masteryLabel,
  vocabLabel,
} from "./index.ts";

describe("词汇常量（来自 docs/product/glossary.yaml）", () => {
  it("掌握六档按序号排列，叫法与代码一一对应", () => {
    expect(MASTERY_CODES).toEqual(["unlearned", "aware", "familiar", "mastered", "applying", "transferring"]);
    expect(MASTERY_RANKS).toEqual([0, 1, 2, 3, 4, 5]);
    expect(masteryLabel(3)).toBe("已掌握");
    expect(masteryCode(5)).toBe("transferring");
  });

  it("页面七态加锁定，代码就是 ?state= 的取值", () => {
    expect(PAGE_STATE_CODES).toEqual(["normal", "loading", "empty", "error", "offline", "restricted", "insufficient_data", "locked"]);
  });

  it("取值叫法、术语、重要度刻度与题目可信度写法", () => {
    expect(vocabLabel("mistake_status", "retrying")).toBe("回炉中");
    expect(VOCAB.confidence.guess).toBe("蒙的");
    expect(TERM.knowledge_map).toBe("知识地图");
    expect(IMPORTANCE_LEVELS).toEqual([1, 2, 3, 4]);
    expect(credibilityLabel("reviewed")).toBe("一级 审定");
  });

  it("硬写检查：找出 TSX 里写死的状态名与档位名，注释与豁免行不算", () => {
    const source = [
      "const a = <p>已掌握</p>;",
      "// 注释里的 未学 不算",
      'const b = "回炉中"; // vocab-exempt: 示例',
      "const c = `${x}数据不足`;",
    ].join("\n");
    expect(findHardcodedTerms(source)).toEqual([
      { line: 1, term: "已掌握" },
      { line: 4, term: "数据不足" },
    ]);
    expect(GUARDED_TERMS).toContain("能迁移");
    expect(GUARDED_TERMS).not.toContain("空");
  });

  it("禁用语与禁用同义词", () => {
    expect(findForbiddenWords("这套题保过")).toEqual([{ word: "保过", use: null }]);
    expect(findForbiddenWords("打开知识图谱")).toEqual([{ word: "知识图谱", use: "知识地图" }]);
    expect(findForbiddenWords("今天先复习")).toEqual([]);
  });
});
