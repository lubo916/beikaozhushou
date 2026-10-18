---
id: METR-01
status: draft
refs:
  api: [trackEvent]
  permissions: [metrics.event.track]
  events: [app_opened, practice_question_answered, today_item_completed]
  errors: [COMMON_VALIDATION, COMMON_FORBIDDEN]
  schema: [analytics_events]
  metrics: [metrics.weekly_effective_learners, metrics.weekly_effective_days, plan.today_completion_rate, plan.consolidate_completion_rate, metrics.next_day_return_rate, metrics.reason_credible_ratio]
  models: [learner-model#effective-learning, planner#completion]
open_questions:
  - id: OQ-METR-01-1
    q: 1 期的指标在哪里看？
    default: 只提供按周输出 CSV 的报表命令，由 Codex 在预发环境运行后交给产品负责人；后台看板在 METR-04（4.6）建
  - id: OQ-METR-01-2
    q: 每周有效学习日数的汇总值以哪些学员为分母？
    default: 当周至少有一条 app_opened 的学员；报表同时给出逐人明细
  - id: OQ-METR-01-3
    q: 巩固段中写明原因剔除的项，是否也不计入巩固段完成率的分母？
    default: 计入。planner 的完成判定一节只对今日清单完成率写明剔除，巩固段按其公式字面计算；负责人决定剔除时，同时修改 docs/models/planner.md
---
# METR-01 埋点事件表与有效学习口径

## 1 目标与边界
北极星先有口径再有看板。埋点只按 contracts/events.yaml 的登记写入同一张只追加的事件表，任何一次作答都会落一条可统计的事件；1 期要看的五个指标在 contracts/metrics.yaml 都有口径，其中可由程序计算的四个连同北极星按口径实现计算、用金标数据验证，并由报表命令按周输出。

不做：后台看板与指标字典界面（METR-04）；practice、plan 在业务流程中调用写入入口（随 PRAC-02、PLAN-02 接入）；学习片段与计划项的生产数据来源（随 learner、plan 的相应功能接入）；指标目标值与最小样本（期初由产品负责人写入）。

## 2 业务规则
- R1 事件登记：每个事件有名称、owner、来源（source）、版本、触发时机、属性与类型、状态；check 对缺字段报 E-SCHEMA-01。只接受 status 为 active 的事件，属性必须与登记完全一致：不多、不少、类型相符。
- R2 trackEvent 先校验角色：当前身份的角色不在 metrics.event.track 允许范围时返回 403 COMMON_FORBIDDEN、不写入。再校验内容：只接受 source 为 client 的事件，请求体只有名称、属性与发生时间（RFC 3339，必须带时区；不校验与服务器时间的偏差）；不合规时返回 422 COMMON_VALIDATION、不写入，并写一条结构化日志（事件名与原因，不含属性值），供按原因计数。
- R3 写入入口由 metrics 包导出，供服务端代码记录 source 为 server 的事件，调用时传入当前身份，校验同 R1；不合规时抛出校验错误、不写入。
- R4 每条事件记录名称、版本、来源、属性、发生时间、接收时间，以及服务端按当前身份得出的学员、租户、是否游客与学员时区。请求体里出现这些身份字段即按 R2 拒绝。
- R5 幂等：带同一 Idempotency-Key 的请求，第一次已写入时，后续请求不论内容都返回第一次的结果，事件只存一条；被拒绝的请求不占用该键。写入入口按调用方给的幂等键同样处理。
- R6 有效学习按 learner-model 的有效学习一节计算：学习片段至少有一条未撤回证据才是有效片段；片段整体计入其开始时刻在学员时区的自然日；自然周为周一至周日。由此得出周有效学习用户数（北极星）与每周有效学习日数（逐人值，以及按 OQ-METR-01-2 的汇总平均值）。没有有效证据的片段（只有在场时长）不计入。
- R7 今日清单完成率与巩固段完成率按 planner 的完成判定一节计算：今日清单完成率的分母不含写明原因剔除的项，巩固段的剔除项按 OQ-METR-01-3。按周、跨学员汇总时，分子与分母分别求和后相除。
- R8 次日回访率：学员在自己时区某日 D 有 app_opened，记一个基数；其中次日也有 app_opened 的记一次回访；周值为 D 落在该周的回访数之和除以基数之和。访谈中“理由可信”的比例为认为任务理由可信的受访人数除以受访人数，由产品负责人按访谈记录计算，不由程序计算。
- R9 报表命令：输入一个 ISO 周，输出一份 CSV，R6 至 R8 中由程序计算的五个指标各一行，含值、分子、分母与数据源状态。学习片段或计划项的数据源未接入时，对应指标标“数据源未接入”，不输出 0；分母为 0 时值留空、标“无样本”。另起两段：每周有效学习日数的逐人明细（数据源未接入时同样标注）；当周按日的作答事件数，日期按事件记录的学员时区切分。

## 3 界面
无界面。学员端上报 app_opened 的时机见 PLAT-01。

## 4 数据
- 新增表 analytics_events（owner 为 metrics，只追加，按学员与租户归属，学员与租户只记 ID、不建外键）；各字段的数据类别见表定义。
- 事件登记增加 source 与 version 字段；app_opened 的属性只有 entry，是否游客记在表字段中。
- 学习片段与计划项以 metrics 包定义的输入结构进入计算：片段含学员、时区、开始与结束时刻、未撤回证据数；计划项含学员、时区、计划日、所属段、完成状态（完成、未完成、写明原因剔除）。

## 5 AI 行为
无。

## 6 验收
METR-01-AC1（R2、R4）
Given 当前身份为学员
When 经 trackEvent 提交一条合规的 app_opened，entry 为 S06
Then 返回 202；事件表多一条记录，名称、版本、来源与属性正确，学员、租户、是否游客与时区取自当前身份

METR-01-AC2（R1、R2、R4）
Given 未登记的名称、source 为 server 的名称、多一个属性、缺一个属性、属性类型不符、带身份字段、发生时间不带时区，各一个请求
When 分别提交
Then 都返回 422 COMMON_VALIDATION，事件表没有新记录，每次各有一条含事件名与原因的日志

METR-01-AC3（R2）
Given 当前身份的角色不在 metrics.event.track 允许范围
When 提交一条合规的 app_opened
Then 返回 403 COMMON_FORBIDDEN，事件表没有新记录

METR-01-AC4（R5）
Given 带同一 Idempotency-Key 的两个合规请求，以及另一个键下先不合规、再合规的两个请求
When 依次提交
Then 前两个都返回 202，事件表只有一条；后两个依次返回 422 与 202，第二个写入

METR-01-AC5（R3、R9）
Given 主种子考试与对照考试的夹具中各取一道题
When 测试经写入入口记录这两次模拟作答（practice_question_answered），再经 trackEvent 提交同名事件一次
Then 两次模拟作答都写入且属性齐全，计入报表当天的作答事件数；经 trackEvent 的那次返回 422

METR-01-AC6（R6）
Given 两个不同时区学员一周的学习片段金标，含没有证据的片段、证据都已撤回的片段、跨午夜的片段
When 计算北极星与每周有效学习日数
Then 结果与手算一致：无效片段不计入，跨午夜片段计入开始那天

METR-01-AC7（R7）
Given 两个学员一周的计划项金标，今日清单与巩固段都含写明原因剔除的项
When 计算这一周的今日清单完成率与巩固段完成率
Then 结果与手算一致：今日清单完成率的分母不含剔除项，巩固段按 OQ-METR-01-3 的临时默认计算，跨学员按分子与分母分别求和

METR-01-AC8（R8）
Given 两个不同时区学员的 app_opened 金标，含次日落在下一周的情形
When 计算某周的次日回访率
Then 结果与手算一致

METR-01-AC9（R9）
Given 只有事件表数据，学习片段与计划项的数据源都未接入；另一周没有任何 app_opened
When 分别对这两周运行报表命令
Then 前一周的 CSV 中次日回访率与按日作答事件数有值，北极星、每周有效学习日数、两种完成率与逐人明细都标“数据源未接入”；后一周的次日回访率值为空、标“无样本”

METR-01-AC10（R1）
Given contracts/events.yaml 中一个事件缺 version，另一个事件的 source 取值不是 client 或 server
When 运行 check
Then 两处各报一条 E-SCHEMA-01

## 7 不变量与合规
无。
