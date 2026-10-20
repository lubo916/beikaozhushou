# 规则卡

> 原型画得出页面，画不出算法。凡是“结果是算出来的”功能（掌握档、复习调度、排程、预测、额度），开工前先写一页规则卡。
> 规则卡由 R 开头的任务起草，你拍板后定稿；后端任务（B 开头）把例子表变成测试。规则卡只写现状，改规则就改卡、改例子、改测试，同一次提交。
>
> 生命周期：草稿（R 任务合并）→ Codex 用大白话讲给你听（一句话、规则、例子、要你拍板的点）→ 你说“规则确认 R01”→ Codex 运行 `bk confirm R01`，卡片状态变为“已定稿”并锁定 → 对应的 B 任务才能出包。已定稿的卡片与 tests/rules/ 下的例子测试只有规则卡任务能改；要改，先说“改规则 R01：……”。两三张卡可以一起看、一起确认，省你的时间。

## 模板（每张卡 1–2 页）

```markdown
# 规则卡：<名称>

- 状态：草稿 / 已定稿（定稿日期、依据的决定卡）
- 用在：页面编号与功能点编号（如 S18-04、S10-05）
- 由谁执行：哪个领域的哪段代码（如 learner 领域的掌握档派生）

## 目的
一两句话：这条规则解决什么问题。

## 输入
列出用到的数据（来自哪些对象与字段）。

## 输出
列出产出的数据（写到哪里），以及页面上显示成什么样。

## 规则（大白话，编号）
R1 …
R2 …
（待拍板的地方写：待拍板：R01-Q2）

## 例子表（至少 8 行：正常、边界、异常都要有）
| 编号 | 情况 | 输入 | 期望输出 | 对应规则 |
|---|---|---|---|---|
| E1 | … | … | … | R1 |

## 参数
| 名称 | 默认值 | 可调范围 | 谁能调 | 说明 |
|---|---|---|---|---|

## 不做
这一版明确不处理的情况。
```

同一份例子表写成 `tests/rules/<名称>.cases.json`：`{"cases": [{"id": "E1", "input": {...}, "expect": {...}, "rule": "R1"}]}`。

## 清单

参数直接引用 contracts/params.yaml 里已有的名字，默认值用表里现有的值（开工决定第 7 条）；需要新参数，在卡的参数表里写建议名与默认值，并写进交接单，由整合任务登记。V3 的算法说明与例子表可以直接沿用：

| 卡 | 文件 | 起草任务 | 使用任务 | 可沿用的 V3 资料与参数 |
|---|---|---|---|---|
| 证据与掌握档 | evidence-mastery.md | R01 | B04 | docs/models/learner-model.md、tests/models/learner-model/cases.yaml；learner.evidence.*、learner.mastery.*、learner.verify.*、learner.self_check.items |
| 记忆调度与复习队列 | review-scheduling.md | R02 | B06 | docs/models/srs.md、tests/models/srs/cases.yaml；learner.memory.*、plan.review.*、practice.recall.relearn_delay_minutes |
| 错题回炉与毕业 | mistake-graduation.md | R03 | B05 | practice.mistake.*；勘误表第 1、2 条 |
| 计划与今日清单 | plan-today.md | R04 | B07 | docs/models/planner.md、tests/models/planner/cases.yaml；plan.consolidate.*、plan.carryover.*、plan.proposal.*、plan.disconnect.*、plan.short_mode.*、plan.sprint.*、plan.calibrate.*、plan.week.* |
| 摸底与起点报告 | diagnosis-start.md | R05 | B08 | learner.prior.min_population |
| 三个数与统计口径 | metrics-prediction.md | R06 | B11 | docs/models/prediction.md、tests/models/prediction/cases.yaml；learner.forecast.*、plan.report.*；contracts/metrics.yaml |
| 模考 | mock-exam.md | R07 | B10 | — |
| 账号生命周期 | account-lifecycle.md | R08 | B13、L02 | account.deregister.cooling_days |
| AI 导师边界 | tutor-boundary.md | R09 | B15、L04 | contracts/ai/actors.yaml、contracts/ai/scenarios.yaml |
| 会员与额度 | billing-quota.md | R10 | B14、L03 | billing.quota.remind_at |
