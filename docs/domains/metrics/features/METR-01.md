---
id: METR-01
status: draft
refs:
  api: [trackEvent]
  permissions: [metrics.event.track, metrics.event.record]
  events: [app_opened, practice_question_answered, today_item_completed]
  errors: [COMMON_VALIDATION, COMMON_FORBIDDEN, COMMON_CONFLICT, COMMON_UNAVAILABLE]
  metrics: [metrics.weekly_effective_learners, metrics.weekly_effective_days, learner.effective_minutes, plan.today_completion_rate, plan.consolidate_completion_rate]
  models: [learner-model#effective-learning, planner#completion]
  adr: [ADR-026]
open_questions:
  - id: OQ-METR-01-1
    q: 1 期的指标看板放在哪里？
    default: 只提供数据查询脚本与表格导出，后台看板在 4.6 建
  - id: OQ-METR-01-2
    q: 次日回访率与访谈里“理由可信”的比例尚未登记，何时确定人群、分母与采集契约？
    default: 本期仅列名称与延期登记状态，不计算候选数值。1 期开工时确认人群、观察窗、分母与样本要求并登记后才交付，本期不新增事件
  - id: OQ-METR-01-3
    q: 公共事件版本与正式身份、存储迁移如何落地？
    default: 0.1 按 foundation 工程前置使用固定开发身份、隔离 JSONL 仓储与构建事件内容哈希；幂等遵守接口约定。请求不自报身份或版本，旧哈希记录保留可查但不按新登记重解释；接真实业务前补正式身份、公共版本与迁移契约并复核
  - id: OQ-METR-01-4
    q: 真实片段边界、重叠、跨日分配、分钟精度与时区历史尚未登记，如何验证？
    default: 本期只验证显式给定、单当地日内、不重叠且 UTC 时长为完整分钟的隔离夹具。真实识别、切分、重叠和舍入由 learner 确认；不支持输入返回 not_ready，不从埋点猜测，不将夹具辅助计算作为生产算法
  - id: OQ-METR-01-5
    q: 重排后的计划分母取哪次快照、巩固段剔除及跨学员聚合如何确定？
    default: 本期夹具显式选择一个带时点的计划快照，并由 plan 替身分别给出两项口径的分母集合与完成集合；不推定日终快照或给巩固段新增剔除规则。真实快照选择、各口径集合与群体比例须经 plan/metrics 确认并登记后实现
---
# METR-01 埋点事件表与有效学习口径

## 1 目标与边界
承担闭环 0.1f：用模拟作答证明受信写入口能落一条可统计事件，提供事件校验、持久化、查询及独立夹具的口径验证。指标字典唯一来源为 contracts/metrics.yaml；公式归 refs.models 的 owner，夹具辅助计算不作为 learner/plan 的生产实现或供其反向调用。
依赖 0.1b 完成工作区、统一错误/身份中间件及登记快照，准确类型、路径与接线归属见 docs/meta/plan/loops/0.1-foundation.md（下称 foundation）。不做业务页面接线、正式登录、证据账本、片段采集、掌握档、计划引擎、生产实时值或看板；发送方页面的触发时机由所属功能验收。

## 2 业务规则
- R1 两种入口共用构建登记校验：AnalyticsEvent 顶层只含必填 name、properties、occurred_at，事件须登记且 active；属性完整且无额外键，null 不满足任何登记类型，uuid/bool/int/string 严格按类型验证，不将字符串转布尔或数字。occurred_at 须为有偏移的合法 ISO 8601 时刻，转 UTC 存储；当前登记未给出的字符串枚举、长度、数值范围、补报/未来时间窗不擅加限制，接真实业务前由 owner 补齐。非法输入返回 COMMON_VALIDATION，不写入。
- R2 事件来源按 events.yaml：公开 trackEvent 只接收 client 的 app_opened；服务端 recordEvent(context,event,key) 只接收 server 事件，practice/plan 的受信 caller 分别写 practice_question_answered/today_item_completed，不接受客户端伪造服务端上下文或事件。两入口都经相同校验与仓储；身份/调用权不符返回 COMMON_FORBIDDEN。app_opened.guest 必须等于服务端身份是否 guest；entry 的业务意义由发送方确定，本功能不自行枚举。
- R3 写操作必带非空 Idempotency-Key（内部为 key），按租户、身份、source、事件名、key 隔离：规范化 payload 相同的重试返回首次 202，不重复写；同命名空间同键不同 payload 返回 COMMON_CONFLICT。只有新记录落盘成功才返回 202；失败返回 COMMON_UNAVAILABLE。事件计数只代表去重后的接收记录数，不能当证据或完成项数。
- R4 有效学习只消费 learner 已接受且未撤回的证据。待验证作答并非已接受证据；negative 指 learner 已接受的负证据，仍可使片段有效，不要求答对或强证据。埋点不写证据/掌握档，不将 duration_ms、actual_minutes 或打开次数换成有效时长；无独立输入返回 not_ready。本期只用第4节的独立 fixture 替代 learner/plan 输入，真实契约接入须替换该适配层并复核。
- R5 按 learner-model#effective-learning 验证夹具：片段有关联的 accepted 未撤回证据才有效；时长取 UTC 终点减起点，片段归其当地自然日，与证据补录日无关；每学员日内任一有效片段即有效日，周内去重日数、去重学员数分别形成周有效日数和北极星。完整分钟时长求和，不做舍入；撤回最后一条证据后，下次查询移除相应片段、日及周贡献。跨午夜、同学员重叠、倒置/零时长、非完整分钟、未知时区历史按 OQ-METR-01-4 返回 not_ready，不静默修正。
- R6 按 planner#completion 验证 fixture 明确选择的快照：plan 给出的 completed 集合除以各自 eligible 集合，不自行从埋点或答题字段重新判完成。夹具中看过/未完成不进分子，今日清单写明原因的剔除项不进分母；巩固段按其显式集合，未知剔除约定按 OQ-METR-01-5。completed 必须是 eligible 子集；零分母 value=null、reason=no_applicable_plan，缺快照/集合冲突为 not_ready，不伪造零或满额。
- R7 日为每学员固定 IANA 时区的自然日，周为当地周一零时至下周一零时的左闭右开区间；不取服务器时区或固定 UTC 偏移。查询按输入即时验证，不建定时任务；refresh 登记不代表本期已实现生产刷新。只输出每学员每日完成率、每学员每周有效日数/分钟及所选周有效学员去重数；不输出群体完成比例或跨周相加去重数。
- R8 事件查询按自身身份、可选事件名与 payload.occurred_at 的 UTC [from,to) 发生窗过滤，只查已落盘记录；recorded_at 仅作入库审计，不参与该筛选。返回记录及 schemaHash，可跨哈希查看原始属性但不重解释。fixture 查询选当地周一日期，只计算该周及其中每天；所有 0.1 输出 simulated=true，输入缺失或不支持时按学员/日期/指标给 not_ready，不污染其他可计算行。目标/最小样本只读生成的指标登记快照，本期所有 conclusion=null，不给达标判断。
- R9 领域包提供开发查询入口 dev:query，调用形态为 pnpm --dir packages/domains/metrics dev:query -- <参数>：events 模式用 --mode events --from --to，可选 --event；fixture 模式用 --mode fixture --fixture --week。共同 --store 指定隔离 JSONL，--output 指定 UTF-8 CSV；未给 output 则写标准输出。CSV 带表头 kind,name,learner_id,period,timezone,value,reason,simulated,schemaHash；kind 为 event_count、metric、not_ready、candidate，事件计数每身份/事件名/发生窗/schemaHash 一行，period 为 R8 的发生窗。两候选只列名称、reason=deferred、value 留空。该 CLI 只供开发自测，不是 ADR-026 的正式业务导出或公开查询接口。

## 3 界面
无业务界面。本期用测试、开发 CLI 与 CSV 检查。

## 4 数据
trackEvent、统一错误体和 metrics.event.track 以契约为准；guest/learner 仅自身范围。固定身份、actor 联合类型与 IANA 时区只取 foundation 的 fixtures/runtime/phase0.json，不从请求属性取得；仅 0 期开发/测试环境使用该上下文，测试可注入其他身份。

仓储接口 EventRepository.appendOnce(record) 返回 inserted/duplicate/conflict，query(filter) 按 R8 返回已提交记录；服务注入仓储、时钟及 UUIDv7 工厂。开发实现为配置路径的只追加 JSONL，不建数据库客户端；记录含 UUIDv7 id、tenant/identity、source、payload、幂等键/规范化摘要、UTC recorded_at、schemaHash、simulated。单进程串行写入并落盘后才成功；测试各用临时目录、可失败替身。损坏文件或不支持的并发写仓储返回不可用，不将半条记录算成功。规范化 payload 递归排序对象键、保留数组顺序，时间转 UTC 后比较；幂等重复保留首次记录的发生时间。

schemaHash：event_count 行取实际记录的 events.yaml 内容哈希，跨哈希按哈希分别计数；metric/not_ready/candidate 行取 metrics.yaml 内容哈希。二者均来自 foundation 的生成快照；生成器由 0.1b 交付，不在运行时读取 YAML 或取 Git HEAD。

隔离输入位于 tests/fixtures/metrics/**，显式 simulated=true、fixtureVersion="0.1"、学员 UUID/固定 IANA 时区；不是跨领域正式契约。片段含 id、learner_id、start/end；evidence 含 id、segment_id、occurred_at/recorded_at、accepted:boolean、revoked:boolean、strength（strong/medium/weak/negative/pending）；pending 必须 accepted=false，只有 accepted 且未撤回参与，引用缺失/重复 ID 返回 not_ready。所有 ID 为 UUID，日期为 YYYY-MM-DD，时间字段均有偏移；start/end 按 [start,end)，end 等于次日零时允许且归前一日，其他跨日不支持。计划含 learner_id、local_date、snapshot_id、as_of、today/consolidate 的 eligibleItemIds/completedItemIds 及 items[{id,status,exclusion_reason}]；status 为 completed/seen/unfinished/excluded，exclusion_reason 为字符串或 null。各集合由 plan 替身预先选定，未注明原因的剔除项留在今日分母。缺字段/冲突不补猜。测试以手算金标验证 fixture，生产 learner/plan 只由各自 owner 实现。

## 5 AI 行为
无。不调用 AI 判定有效学习或计算完成率。

## 6 验收
- METR-01-AC1 两入口对缺/多顶层字段、未知或非 active 事件、缺/多属性、null、错误 UUID/布尔/整数/字符串及非法时间返回 422/COMMON_VALIDATION 且无记录；合法 client/server 事件经各自入口写入并保留属性，未登记范围不暗加校验。
- METR-01-AC2 模拟受信 practice 调用一次查到一条作答事件；未调用无记录。公开 API 伪造两类 server 事件、错 caller、非允许角色或越身份均 403/COMMON_FORBIDDEN；guest 属性与身份不符为 422。无需真实业务页面、证据或完成判定。
- METR-01-AC3 JSONL 写入后重启能查到原属性/hash；哈希等于构建登记内容 SHA-256，旧哈希仍可查。缺幂等键为 422；相同 namespace/key/payload 重试与并发重试只一条且仍 202，payload 改变为 409/COMMON_CONFLICT；注入写失败/损坏文件为 503/COMMON_UNAVAILABLE，无虚假接收。
- METR-01-AC4 多学员、同日多片段与跨日补录证据的 fixture 金标验证去重用户/日及分钟；negative 已接受证据有效，pending、撤回、仅在场无贡献；仅有埋点缺独立输入为 not_ready。不支持的跨日、重叠、时长或引用输入明确 not_ready。
- METR-01-AC5 撤回最后一条证据后重新查 fixture，移除对应分钟以及失去最后片段的日/周贡献，与从未提供该证据一致，不修改埋点或证据存储。
- METR-01-AC6 明确快照含完成、看过、未完成、有/无原因剔除，分别按 plan 替身给出的两组集合验证比例；重复完成埋点不改变比例。零分母为空且无适用计划；缺快照/集合冲突为 not_ready，不自行选日终分母。
- METR-01-AC7 固定 IANA 时区覆盖午夜、周日到周一、夏令时；UTC 时长与当地归日分别手算一致，端点左闭右开且服务器时区不影响结果。夹具覆盖 Asia/Shanghai 及有夏令时的时区，生产时区变更不由 fixture 推断。
- METR-01-AC8 仓储与 CLI events 按发生时间筛选：已落盘事件发生窗外/入库窗内不计入，发生窗内/入库窗外计入；同键同 payload 重试不改变发生时间或计数。CSV period 为该发生窗，列与粒度符合 R9；模拟、not_ready、无适用计划及延期候选可区分。event_count 不冒充证据指标，候选 value 为空，所有行无达标结论；无正式看板、实时算法或业务导出。元数据引用生成登记。

## 7 不变量与合规
properties 只含登记属性；禁止夹带手机号、邮箱、答题正文、导师对话或密钥。错误 details 只给字段路径和错误类别，不回显值；身份隔离包含 tenant/identity。学习证据/掌握档只由 learner 写，完成判定只由 plan 提供。fixture、事件和 CSV 均仅开发者模拟数据；单位换算、HTTP 状态和测试时间等常量豁免按 foundation，不当作可调阈值。
