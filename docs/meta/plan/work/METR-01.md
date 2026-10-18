---
id: METR-01
branch: feat/METR-01-events
lane: 标准
started: （由 work start 填写）
---
# METR-01 进行中

## 计划（确认后才动代码）
- 前置：0.1b 已合入主干（analytics_events 表已随首个迁移建好；请求身份、统一错误体、角色校验、事件与指标登记的生成物、trackEvent 的 Zod 结构与钩子均已就位，测试可经 buildApp 的选项注入请求身份，见 docs/meta/plan/work/0.1b.md 第 3 节）；PLAT-02 已合入。
- Codex 先做（出包前提交在本分支；这些文件 Claude 不改）：
  1. spec_tool 的检查增加事件登记完整性（规格 R1）：七个字段缺一报 E-SCHEMA-01；source 只取 client 或 server；属性类型只取 string、uuid、bool、int。写工具测试。
- 改动文件：
  - packages/domains/metrics/src/events/validate.ts（按登记校验名称、来源、状态、属性与发生时间）
  - packages/domains/metrics/src/events/store.ts（经数据访问层写入事件表，幂等去重）
  - packages/domains/metrics/src/events/record.ts（服务端写入入口）
  - packages/domains/metrics/src/api/routes.ts（埋点上报接口：先校验角色，再校验内容，拒绝时写结构化日志）
  - packages/domains/metrics/src/compute/calendar.ts（学员时区的自然日与周一至周日的自然周）
  - packages/domains/metrics/src/compute/effective-learning.ts（北极星与每周有效学习日数）
  - packages/domains/metrics/src/compute/completion.ts（今日清单完成率与巩固段完成率）
  - packages/domains/metrics/src/compute/return-rate.ts（次日回访率）
  - packages/domains/metrics/src/report/sources.ts（学习片段、计划项与事件三类数据源的接口，未接入时为空）
  - packages/domains/metrics/src/report/report.ts（按周汇总、数据源状态、逐人明细与 CSV）
  - packages/domains/metrics/src/report/cli.ts（报表命令入口）
  - packages/domains/metrics/src/index.ts（导出写入入口与计算函数）
  - packages/domains/metrics/package.json（报表命令脚本）
- 参考文件：
  - contracts/events.yaml
  - contracts/metrics.yaml
  - contracts/permissions.yaml
  - contracts/schema/metrics.prisma
  - packages/db/src/
  - packages/contract/src/
  - packages/domains/metrics/src/generated/
  - apps/api/src/app.ts
  - apps/api/src/context.ts
  - apps/api/src/errors.ts
  - docs/models/learner-model.md
  - docs/models/planner.md
  - fixtures/exams/junior-accounting/questions.json
  - fixtures/exams/cet-6/questions.json
  - ./vitest.config.ts
- 契约变更：无。事件登记的 source 与 version、app_opened 的属性、analytics_events 表、两个新指标、trackEvent 的幂等键与 403 已随规格批次合入。
- AC → 测试：
  - METR-01-AC1 → apps/api/src/events.test.ts：[METR-01-AC1] 合规的 app_opened 返回 202 并按当前身份写入
  - METR-01-AC2 → apps/api/src/events.test.ts：[METR-01-AC2] 七类不合规请求都返回 422、不写入、各写一条日志
  - METR-01-AC3 → apps/api/src/events.test.ts：[METR-01-AC3] 不允许的角色返回 403、不写入
  - METR-01-AC4 → apps/api/src/events.test.ts：[METR-01-AC4] 同一幂等键只存一条；被拒绝的请求不占用键
  - METR-01-AC5 → packages/domains/metrics/src/events/record.test.ts：[METR-01-AC5] 主种子与对照考试各一次模拟作答写入并计入当天作答事件数；经 trackEvent 提交同名事件返回 422（这半句的断言放在 apps/api/src/events.test.ts，标题同样带此标签）
  - METR-01-AC6 → packages/domains/metrics/src/compute/effective-learning.test.ts：[METR-01-AC6] 两个时区一周学习片段的金标
  - METR-01-AC7 → packages/domains/metrics/src/compute/completion.test.ts：[METR-01-AC7] 含剔除项的计划项金标（今日清单剔除；巩固段按 OQ-METR-01-3）
  - METR-01-AC8 → packages/domains/metrics/src/compute/return-rate.test.ts：[METR-01-AC8] 两个时区、次日跨周的回访金标
  - METR-01-AC9 → packages/domains/metrics/src/report/report.test.ts：[METR-01-AC9] 数据源未接入、无样本与逐人明细的报表输出
  - METR-01-AC10 → tests/tooling/test_events_registry.py：[METR-01-AC10]（Codex 写，先做第 1 项；标签写在测试方法文档字符串首行，0.1b 起由 verify 运行并计入结果）
- 金标数据：放 tests/fixtures/metrics/，每个文件附 note 字段写明手算过程。学员时区至少用 Asia/Shanghai 与一个有夏令时的时区（如 America/New_York），周的范围覆盖一次夏令时切换。巩固段的剔除项按 OQ-METR-01-3 的临时默认计入分母。
- 实现要点（给实现者）：
  1. 校验以生成的事件登记为唯一来源，不在代码里另写事件名与属性表；属性类型 uuid 按标准格式校验，int 必须是整数。
  2. 发生时间必须是带时区的 RFC 3339 字符串并能解析为有效时刻，存为 UTC；不校验与服务器时间的偏差。
  3. 学员、租户、是否游客与时区一律取 RequestContext；请求体按结构不允许额外字段，出现即 422。
  4. 幂等键在 idempotency_key 列唯一；重复键返回 202、不再写入；校验失败的请求不落库，所以不占用键。
  5. 拒绝日志走 pino，字段为事件名与原因代码，不含属性值与身份信息。
  6. 计算函数是纯函数，输入结构按规格第 4 节，时区换算用 @date-fns/tz；报表命令通过数据源接口取数，学习片段与计划项两个数据源在本功能中为未接入。
  7. 模拟作答用的题目与知识点 UUID：用 uuid 包的 v5，以夹具中的题目 ID 与知识点名称派生，命名空间常量放在测试夹具里；不改夹具与正式导入的 ID 规则。
- 风险与不确定：
  1. 写库测试依赖 0.1b 的测试库与测试辅助；CI 中 PostgreSQL 服务容器不可用时，这些测试会失败而不是跳过。
  2. 报表命令在预发运行需要数据库连接，由 Codex 在预发容器内执行后把 CSV 交给负责人（OQ-METR-01-1 的临时默认）。
  3. practice 与 plan 将来调用写入入口的方式（订阅业务事件，或由应用装配注入）在 PRAC-02、PLAN-02 的规格中定，不改变 docs/product/domain-map.yaml 的依赖方向。
  4. 每周有效学习日数的汇总分母按 OQ-METR-01-2 的临时默认；负责人改了要同步改报表与金标。
  5. 巩固段剔除项按 OQ-METR-01-3 的临时默认；负责人改了要同步改计算、金标与 docs/models/planner.md。
- 确认：（谁、何时）

## 决定
（会话中做的取舍，一行一条，行尾写去向：→ 规格 R<n> / → ADR-<nnn> / → 不保留。）

## 进度
- [ ] Codex：先做第 1 项并提交
- [ ] 出包第 1 轮
- [ ] 回包、verify、按 review-change 复查
- [ ] 在预发跑一次报表命令，CSV 交给负责人
- [ ] work close、PR、CI 全绿后合并

## 交接记录
| 时间 | 工具 | 做了什么 | 下一步 |
|---|---|---|---|

## 包外读取
（读了任务包以外的文件时记一行：文件与原因。）

## 复核
（冷启动复核与异构复查的结论。）

## 未决
