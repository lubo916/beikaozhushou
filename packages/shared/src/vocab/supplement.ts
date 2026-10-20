// F03 临时补在这里的五组叫法，已于 F04 补登记进 docs/product/glossary.yaml（F03-Q3＝A）：改为从生成的词汇常量取，
// 常量名不变（公共组件与组件陈列页在用），新代码直接用 VOCAB.<术语代码>。今日三段的说明句不是术语，仍放这里。
import { VOCAB } from "./glossary.generated.ts";

/** 提议的四个状态（术语表 proposal_status）。 */
export const PROPOSAL_STATUS = VOCAB.proposal_status;
export type ProposalStatusCode = keyof typeof PROPOSAL_STATUS;

/** 今日清单三段（术语表 today_segment）与每段的说明句（vocabulary.md 第 4 节；说明句不是术语，不进术语表）。 */
export const TODAY_SEGMENT = VOCAB.today_segment;
export const TODAY_SEGMENT_HINT = { consolidate: "推迟就有损失", advance: "推迟无损失", closing: "当天最后的短任务" } as const;
export type TodaySegmentCode = keyof typeof TODAY_SEGMENT;

/** 三档降级（术语表 degrade_tier）。 */
export const DEGRADE_TIER = VOCAB.degrade_tier;
export type DegradeTierCode = keyof typeof DEGRADE_TIER;

/** 三个数卡片上的问句（术语表 three_number_question）。 */
export const THREE_NUMBER_QUESTION = VOCAB.three_number_question;

/** 题目可信度的界面简称（术语表 credibility_short；界面写“几级＋简称”，F03-Q4＝A）。 */
export const CREDIBILITY_SHORT = VOCAB.credibility_short;

/** AI 生成内容的统一叫法（vocabulary.md 第 8 节）；复制、下载、导出时也带上。 */
export const AI_GENERATED = "AI 生成";
