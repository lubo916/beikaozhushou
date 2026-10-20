// 术语表（docs/product/glossary.yaml）还没收的叫法：按 docs/baseline/vocabulary.md 临时补在这里（F03 用户拍板：先在代码里补上，标明“待补登记”）。
// 术语表补登记后改由 glossary.generated.ts 提供，并删掉这里对应的常量；补登记清单见 F03 交接单「风险与提醒」。

/** 提议的四个状态（vocabulary.md 第 4 节）。待补登记。 */
export const PROPOSAL_STATUS = { pending: "待确认", confirmed: "已确认", declined: "不改", undone: "已撤销" } as const;
export type ProposalStatusCode = keyof typeof PROPOSAL_STATUS;

/** 今日清单三段的段名与说明（vocabulary.md 第 4 节）。待补登记。 */
export const TODAY_SEGMENT = { consolidate: "巩固", advance: "推进", closing: "收尾" } as const;
export const TODAY_SEGMENT_HINT = { consolidate: "推迟就有损失", advance: "推迟无损失", closing: "当天最后的短任务" } as const;
export type TodaySegmentCode = keyof typeof TODAY_SEGMENT;

/** 三档降级（vocabulary.md 第 4 节）。待补登记。 */
export const DEGRADE_TIER = { full: "完整版", lite: "精简版", minimal: "保底版" } as const;
export type DegradeTierCode = keyof typeof DEGRADE_TIER;

/** 三个数卡片上的问句（vocabulary.md 第 5 节）。待补登记。 */
export const THREE_NUMBER_QUESTION = { forecast_gap: "够不够", completion: "走了多远", health: "来不来得及" } as const;

/** 题目可信度的界面简称（vocabulary.md 第 3 节：界面写“几级＋简称”）；三、四级的简称待拍板（F03 交接单问题）。 */
export const CREDIBILITY_SHORT = { reviewed: "审定", own: "自有", generated_confirmed: "已确认生成", generated_instant: "即时生成" } as const;

/** AI 生成内容的统一叫法（vocabulary.md 第 8 节）；复制、下载、导出时也带上。 */
export const AI_GENERATED = "AI 生成";
