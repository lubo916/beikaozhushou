---
id: LRN-01
status: draft
refs:
  schema: [evidence_events, mastery_levels]
  domain_events: [evidence.recorded, evidence.revoked, mastery.changed]
  api: [recordEvidence, getMasteryGrid]
  permissions: [learner.evidence.record, learner.mastery.read]
  params: [learner.evidence.strength_weights, learner.mastery.level_thresholds, learner.evidence.min_for_sufficient]
  data_classes: [personal_learning, inferred]
  models: [learner-model#evidence-strength, learner-model#mastery-derivation, learner-model#evidence-sufficiency, learner-model#recompute]
  adr: [ADR-005]
---
# LRN-01 证据账本与掌握档派生

## 1 目标与边界
写入证据后掌握档按规则重算，同一份证据重放结果一致（分期规划 0.2c、0.2d，ADR-005）。
不做：待验证与可信度上限（LRN-02）；记忆状态（LRN-03）；档位依据的展示（LRN-02）。

## 2 业务规则
- R1 证据只追加：recordEvidence 写入 evidence_events，带幂等键；同一键重复写入返回第一次的结果。
- R2 撤回写一条 revoke 事件，被撤回的证据不再计分。
- R3 证据强度按 docs/models/learner-model.md 的证据强度表计算；本功能实现正确与错误、把握度与“把握度已关闭”的规则。
- R4 累计分为未撤回证据的权重之和（learner.evidence.strength_weights），最低为 0；掌握档为累计分达到的 learner.mastery.level_thresholds 门槛数；达到已掌握及以上至少要有一条强证据。
- R5 来自不同题目的有效证据少于 learner.evidence.min_for_sufficient 条时，充分性为证据不足。
- R6 每次写入或撤回后增量重算该知识点；档位或充分性变化时发布 mastery.changed；写入与撤回分别发布 evidence.recorded 与 evidence.revoked。
- R7 全量重算与增量结果一致。
- R8 掌握档、证据强度、把握度、知识类型、错因、陷阱类型的取值与代码标识以 glossary.yaml 的 values 为源，界面与算法引用同一份常量。

## 3 界面
无（方格与知识点页在 MAP-02）。

## 4 数据
表 evidence_events（personal_learning，强度字段为 inferred）与 mastery_levels（inferred）；接口 recordEvidence（只供领域服务调用，动作 learner.evidence.record）与 getMasteryGrid（动作 learner.mastery.read）。

## 5 AI 行为
无。

## 6 验收
- LRN-01-AC1 同一幂等键写入两次，只有一条证据，返回结果相同。
- LRN-01-AC2 连续写入达到门槛的强证据后，掌握档逐级上升，与参数门槛一致。
- LRN-01-AC3 只有中证据时，掌握档不超过已熟悉。
- LRN-01-AC4 撤回一条证据后，掌握档与从未写入时相同。
- LRN-01-AC5 随机证据序列的全量重算结果等于增量结果（性质测试）。
- LRN-01-AC6 证据少于充分门槛时返回证据不足。
- LRN-01-AC7 档位变化时发布一条 mastery.changed，未变化时不发布。

## 7 不变量与合规
证据账本只由本领域写入（检查 E-OWN-02）。
