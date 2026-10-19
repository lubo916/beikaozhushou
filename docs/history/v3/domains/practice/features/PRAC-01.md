---
id: PRAC-01
status: draft
refs:
  api: [nextQuestion, submitAnswer, recordEvidence, getMasteryGrid]
  schema: [practice_sessions, answer_records]
  errors: [PRAC_REVEAL_LOCKED]
  inv: [INV-24]
  features: [LRN-01, CONT-02, PLAT-01]
---
# PRAC-01 行走骨架：知识点页做一题到方格变色

## 1 目标与边界
用最细的一刀打通端到端链路：在知识点页做一道题，地图上对应的格子变色（分期规划 0.3，黄金路径 GP-0）。
不做：把握度、分层解析、错题收录、练习入口（1.1 与 1.3）。

## 2 业务规则
- R1 知识点页最简版显示知识点名称、当前掌握档与“做一题”按钮。
- R2 点“做一题”经 nextQuestion 取该知识点的一道题，进入沉浸作答界面。
- R3 提交经 submitAnswer：写入 answer_records 并揭晓对错；本功能不询问把握度，按“把握度已关闭”处理。
- R4 揭晓后不能修改答案；再次提交返回 PRAC_REVEAL_LOCKED。
- R5 揭晓时由 practice 调用 recordEvidence 写入证据，掌握档随之重算。
- R6 方格全景最简版经 getMasteryGrid 按六档着色；做题后返回方格，对应格子显示新的档位颜色。

## 3 界面
知识点页取 S10 的头部区块为布局参考，方格取 S09 的方格全景为布局参考，作答界面取 S18 的沉浸模式；本功能不覆盖这些页的条目，完整实现见 1.1。

## 4 数据
表 practice_sessions、answer_records；接口 nextQuestion、submitAnswer、getMasteryGrid，以及 learner 的 recordEvidence。

## 5 AI 行为
无。

## 6 验收
- PRAC-01-AC1 在知识点页做对一道题后，返回方格，该知识点的格子颜色对应重算后的档位。
- PRAC-01-AC2 揭晓后再次提交同一题，返回 PRAC_REVEAL_LOCKED，答案不变。
- PRAC-01-AC3 断网重试提交（同一幂等键）只产生一条作答与一条证据。
- PRAC-01-AC4 黄金路径 GP-0 的端到端测试在主种子与对照考试上都通过。

## 7 不变量与合规
INV-24：揭晓后不能修改答案。
