# 学习者模型

由证据派生每个知识点的掌握档与证据充分性，只由 learner 领域实现（ADR-005）。决策表与参数默认值为临时默认，由探针 0.4A 定稿（OQ-002）。

## 输入 <a id="inputs"></a>
- 证据事件（contracts/schema/evidence_events.yaml）：来源、题目与版本、题目可信度、对错、把握度、用时、提示等级。
- 题目的预期用时：题目自带，缺省时取题型默认。
- 知识地图映射（knowledge_point_mappings）：合并、拆分、移动、退役。

## 输出 <a id="outputs"></a>
- 每个知识点的掌握档（0 至 5，对应 glossary 的六档）、累计分、证据充分性、是否待验证，写入 mastery_levels。
- 档位变化时发布业务事件 mastery.changed。

## 不变量 <a id="invariants"></a>
- 蒙对或用时过短的正确作答不升档（INV-25）。
- 证据只追加；撤回写 revoke 事件；同一规则版本下，从证据全量重算的结果与增量结果一致。
- 自评不直接改变掌握档。

## 证据强度 <a id="evidence-strength"></a>
按下表从上到下取第一条命中的规则：

| 条件 | 强度 |
|---|---|
| 正确，把握度为“蒙的” | 待验证 |
| 正确，用时短于预期用时乘以 learner.evidence.fast_answer_ratio | 待验证 |
| 正确，把握度为“确定” | 强 |
| 正确，把握度为“模糊” | 中 |
| 正确，把握度已关闭 | 中（最高） |
| 错误 | 负 |

在此基础上依次修正：使用了提示，强度降一级（强降为中、中降为弱）；强度不超过 learner.evidence.credibility_caps 中该题可信度对应的上限；已确认的生成题同时满足先做后核、质检通过、有出处时，上限与审定题相同（S17-05）。只凭生成题升到“已掌握”及以上时，须有另一道不同的题结果一致（异题印证，5.6 起生效）。

## 待验证 <a id="pending-verification"></a>
- 待验证的证据不计分，只记录。
- 记录后经过 learner.verify.recheck_after_hours 小时，同一知识点换一道题复考，作为“待验证复核”任务进入今日巩固段。
- 复考按证据强度表正常计分；原待验证证据保持不计分，不重复计入。

## 档位派生 <a id="mastery-derivation"></a>
- 累计分为该知识点全部未撤回、非待验证证据的权重之和，权重取 learner.evidence.strength_weights，最低为 0。
- 掌握档为累计分达到的 learner.mastery.level_thresholds 门槛数（0 至 5）。
- 达到“已掌握”及以上，至少要有一条来自做题的强证据；复习自评与回忆的证据最多把掌握档推到“已熟悉”。
- 遗忘风险由记忆状态单独表达（docs/models/srs.md），不自动降低掌握档。

## 证据充分性 <a id="evidence-sufficiency"></a>
- 来自不同题目的未撤回、非待验证证据少于 learner.evidence.min_for_sufficient 条时为“证据不足”，方格显示虚线格，不等于“不会”（S09-04）。
- 知识点被拆分后，新点从“证据不足”开始，学习记录按映射保留，不清零（S09-14）。

## 自评 <a id="self-assessment"></a>
- 档位阶梯同时显示系统判定、自评与目标档（S10-01）。
- 自评“已掌握”时随即出一两道检验题；检验作答以 self_check 为来源，按证据强度表计分；不作答则自评只显示、不生效（S10-08）。

## 有效学习 <a id="effective-learning"></a>
- 有效学习片段：产生了至少一条已入账且未撤回证据的连续学习片段；有效学习时长只计这些片段，在场时长并列显示，补做检测可把片段转为有效（S24-08）。已入账指 learner 接受并用于证据账本的记录，含负证据，不要求答对；待验证作答按 glossary 的“复考通过才计入证据”只作待复核记录，不使片段有效。复考产生的新证据归其实际关联片段，原待验证记录保持不计入，不重复入账。METR-01 的 accepted 仅为此状态的隔离夹具表示，不新增生产字段或由 metrics 判定入账。
- 有效学习日：学员时区内当天至少有一个有效学习片段。
- 每周有效学习日数：一个自然周（周一至周日）内的有效学习日数。
- 周有效学习用户数（北极星）：该自然周内至少有一个有效学习日的用户数。

## 重算 <a id="recompute"></a>
- 触发：新证据（增量）、证据撤回（题目事后改了答案，S18-26）、地图映射迁移、规则版本变化。
- 全量重算与增量结果一致，作为性质测试保留。

## 引用的参数 <a id="params"></a>
learner.evidence.strength_weights、learner.evidence.credibility_caps、learner.evidence.fast_answer_ratio、learner.evidence.min_for_sufficient、learner.mastery.level_thresholds、learner.verify.recheck_after_hours。

## 验收方式 <a id="acceptance"></a>
- tests/models/learner-model/ 保存决策表的金标数据（探针 0.4A 把原型规则写成测试表），每条规则至少一个正例和一个反例。
- 性质测试：随机证据序列的全量重算等于增量结果；撤回后重算等于从未写入。

## 补充引用的参数

- `learner.mastery.cross_check_items`：升到已掌握及以上所需的不同题目数（异题印证）
- `learner.self_check.items`：自评已掌握时出的检验题数
