---
id: METR-01
status: draft
refs:
  api: [trackEvent]
  permissions: [metrics.event.track]
  events: [app_opened, practice_question_answered, today_item_completed]
  metrics: [metrics.weekly_effective_learners, metrics.weekly_effective_days, learner.effective_minutes, plan.today_completion_rate, plan.consolidate_completion_rate]
  models: [learner-model#effective-learning, planner#completion]
open_questions:
  - id: OQ-METR-01-1
    q: 1 期的指标看板放在哪里？
    default: 只提供数据查询脚本与表格导出，后台看板在 4.6 建
---
# METR-01 埋点事件表与有效学习口径

## 1 目标与边界
北极星先有口径，再有看板：任何一次作答都会落一条可统计的事件，周有效学习用户数等 1 期观测指标可查（分期规划 0.1f）。
不做：运营驾驶舱与指标字典界面（4.6）。

## 2 业务规则
- R1 只接受 contracts/events.yaml 登记的事件；未登记事件或属性不符的上报被拒绝并计数。
- R2 每次作答揭晓上报一条 practice_question_answered；今日清单一项按证据判定完成时上报一条 today_item_completed；学员端启动或回到前台上报 app_opened。
- R3 有效学习片段、有效学习日与北极星的口径按 docs/models/learner-model.md 的有效学习一节计算；在场时长不计入有效学习。
- R4 今日清单完成率与巩固段完成率按 docs/models/planner.md 的完成判定一节计算。
- R5 指标按学员时区的自然周与自然日汇总。

## 3 界面
无。

## 4 数据
接口 trackEvent（动作 metrics.event.track）；指标口径登记在 contracts/metrics.yaml，事件登记在 contracts/events.yaml。

## 5 AI 行为
无。

## 6 验收
- METR-01-AC1 上报未登记事件返回校验错误，且不入库。
- METR-01-AC2 完成一道题后能查到一条 practice_question_answered，属性齐全。
- METR-01-AC3 给定一周的证据序列，周有效学习用户数与每周有效学习日数与手算结果一致。
- METR-01-AC4 只有在场、没有证据的片段不计入有效学习时长。
- METR-01-AC5 跨时区的学员按自己的时区切分自然日。

## 7 不变量与合规
埋点属性不含手机号等账号信息。
