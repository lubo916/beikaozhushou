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
    default: 只提供开发查询与模拟表格，后台看板在 4.6 建
  - id: OQ-METR-01-2
    q: 次日回访率与访谈里“理由可信”的比例尚未登记，何时确定人群、分母与采集契约？
    default: 本期只在此说明延期，不输出候选行或硬编码候选名称。1 期开工确认并登记后交付，本期不新增事件
  - id: OQ-METR-01-3
    q: 公共事件版本与正式身份、存储迁移如何落地？
    default: 0.1 用 foundation 的模拟身份、隔离 JSONL 与事件内容哈希；请求不自报身份/版本，旧哈希仅查原记录。真实接入前补正式身份、版本与迁移契约
  - id: OQ-METR-01-4
    q: 真实片段边界、重叠、跨日、分钟精度与时区历史如何确定？
    default: 本期只算显式完整、单当地日、不重叠且 UTC 时长为完整分钟的夹具；真实识别/切分/舍入由 learner 确认。不支持输入返回 not_ready，夹具不作为生产算法
  - id: OQ-METR-01-5
    q: 重排后的快照选择、巩固段剔除及跨学员聚合如何确定？
    default: 本期 plan 替身显式选择快照和两项口径集合，按支持契约验证一致性；不推定日终快照/巩固剔除。真实规则经 owner 确认登记后实现
---
# METR-01 埋点事件表与有效学习口径

## 1 目标与边界
承担 0.1f：模拟受信作答能落一条可查询事件；交付事件校验、持久化、查询及独立夹具验证。指标字典唯一来源 contracts/metrics.yaml，公式归 refs.models 的 owner；不实现或反向提供 learner/plan 生产算法。
依赖 0.1b 的工程、统一错误/身份与生成快照。共同前置见 docs/meta/plan/loops/0.1-foundation.md（foundation）；精确接口、仓储、夹具语义和 CSV 见 docs/domains/metrics/phase0-contract.md（支持契约），结构见同目录 contracts/phase0-fixture.schema.json。支持文件只定义 0 期模拟适配层，不复制业务登记。
不做业务页面、正式登录、证据账本、片段采集、掌握档、计划引擎、生产实时值或看板；app_opened 接线及发生点验收归 0.1b，真实业务事件触发归后续所属功能。

## 2 业务规则
- R1 两入口使用同一生成事件登记：只接收 name/properties/occurred_at，必填且无额外键；事件 active，属性完整无额外键，null/错型不强转。时间采用支持契约的带偏移 RFC3339、最高毫秒精度，拒绝高精度而非截断，规范化 UTC。未登记字符串枚举、长度、数值范围和补报/未来时间窗不擅加。
- R2 公开 trackEvent 只允许 client/app_opened；受信 recordEvent 只允许 domain actor、登记 callers 内且符合事件 owner 的 server 事件。身份 role 只接受 guest/learner（guest 可由 practice 代记）；目标永远 Context 本人，无目标身份参数。按 foundation 的上下文→角色/caller→已知来源/owner→完整输入/幂等键→幂等→仓储顺序检查。app_opened.guest 不等于上下文是否 guest 是 422；公开提交已知 server 事件为 403。签名及返回/错误见支持契约。
- R3 幂等键采用 foundation 的可见 ASCII 和长度约束，不 trim 后接收。命名空间 tenant/identity/source/name/key；递归排序对象键、保留数组次序、时间转固定毫秒 UTC 后比较 payload。相同重试保留首次 eventId 和记录，不重复写；不同 payload 为 COMMON_CONFLICT。只有 fsync 成功才接收，仓储不可用为 COMMON_UNAVAILABLE。
- R4 有效学习只消费 learner 定义的已接受且未撤回证据，accepted 的含义以 learner-model#effective-learning 为准；待验证不计，已接受负证据可使片段有效，不要求答对/强证据。埋点不写证据或掌握档，不以 duration_ms/actual_minutes/打开次数推算有效时长。本期输入是隔离夹具，真实接入须换适配层并复核。
- R5 夹具中有关联 accepted 未撤回证据的片段才有效；UTC 终点减起点为时长，按片段当地自然日归属，不按补录日。仅支持同日（终点恰为次日零时允许）、正时长、完整分钟、同学员不重叠、固定 IANA 时区。撤回最后一条证据后重查，移除相应片段/日/周贡献。unsupported/missing 不估算下界，按支持契约向该学员周值和全体周人数传播 not_ready。
- R6 每学员每日通过 selectedSnapshotId 显式选择 plan 替身快照；today/consolidate 各有 items、eligibleItemIds、completedItemIds，不据埋点重判完成。集合一致性按支持契约；不将两段子集关系或巩固剔除规则写成生产事实。分子为完成集合大小，分母为适用集合大小；零分母 value=null/reason=no_applicable_plan，缺快照/冲突为 not_ready。未给原因的今日剔除项仍留分母，看过/未完成不进分子。
- R7 以 fixture roster 为输出全集：每学员所选周七日各两项完成率、周有效日数、周有效分钟，另全体该周有效学员去重数。完整空学习日是真 0；缺日/缺输入不等于 0。周从每学员当地周一零时起至下周一零时左闭右开；统一所选周一日期，不用服务器时区/固定偏移。只做查询时夹具计算，不实现 refresh 任务、群体完成比例或跨周人数相加。
- R8 领域事件 query 按 Context 本人的 tenant/identity、可选事件名、payload.occurred_at 的 UTC [from,to) 发生窗查已提交记录；recorded_at 仅审计。可信开发 CLI 可读隔离仓储全部身份，二者接口分开。旧 schemaHash 原样查且不按新登记重解释；event_count 不能当证据/完成项数。所有 0.1 数据 simulated=true，目标/样本元数据取生成登记，conclusion 一律 null，不给达标结论。
- R9 开发命令 pnpm --dir packages/domains/metrics dev:query -- <参数>，先按 foundation 用 tsc 构建再由 Node 运行，不增加 TS 运行器。events 模式 --mode events --from --to [--event]；fixture 模式 --mode fixture --fixture --week；共同 --store/--output 可选，UTF-8 CSV 默认标准输出。输出列/格式/精度/reason/错误退出见支持契约，只输出登记事件/指标，不输出 candidate。它是可信模拟验证工具，不是 ADR-026 正式业务导出/公开查询。

## 3 界面
无业务界面；测试、开发 CLI 和 CSV 验证。

## 4 数据与接口
上下文只取 foundation 的 fixtures/runtime/phase0.json 及受信测试注入，不从属性读取身份、租户或版本；development/test/staging 使用模拟适配器，0 期 production 拒绝启动。staging 仓储卷归 0.1b。
从 packages/domains/metrics/index.ts 导出 createMetricsService 和依赖类型，实例提供受信 recordEvent/self query；0.1b 注入仓储/时钟/UUIDv7 工厂。JSONL 由 EXAM_PREP_METRICS_STORE 指定，默认 foundation 的 appStateDir/metrics/events.jsonl，串行写、fsync、跨进程排他锁；损坏任何行（含尾部半行）均不可用，不自动截断/解锁。
记录字段、仓储接口及故障处理见支持契约。事件行保存实际 events.yaml 原字节 SHA-256；指标行取 metrics.yaml 哈希，均由 0.1b 构建快照提供，不运行时读 YAML/Git HEAD。
夹具在 tests/fixtures/metrics/**，JSON Schema 约束形状、支持契约约束引用/集合/输出。两考试以 profile.exam_id 参数化复跑相同断言；测试合成 UUIDv7 对照表关联原题 ID/知识点名称，不把原题字符串冒充 UUID，不修改 CONT/MAP 正式导入。手算金标独立于实现。

## 5 AI 行为
无。不调用 AI 判定学习或完成率。

## 6 验收
- METR-01-AC1 两入口严格验证顶层、事件状态、属性、UUID/布尔/整数/字符串/null；覆盖 RFC3339 的 Z/正负偏移/毫秒及拒绝省秒、t/z、闰秒、高精度、未知偏移 -00:00（+00:00 有效）。合法等价时间规范化相同；按检查优先级返回登记码且无写入，不因类型库只接受 Z 拒绝合法偏移。
- METR-01-AC2 两考试使用显式合成 UUIDv7 映射，受信 practice 模拟一次查一条，未调用无记录；guest/learner 均可按来源授权。公开 server 事件、错 caller、非法 role 为 403；身份额外顶层字段与 guest 不匹配为 422。复合错误按 R2 优先级，不构造不存在的目标身份参数。
- METR-01-AC3 写后重启保留属性/hash/id，旧 hash 可查。键缺失/空白/字符/长度错误 422；同键同 payload 并发重试一条且相同 eventId，不同 payload 409。fsync/写入失败、中间坏行、尾部半行、锁占用均不可用，不截断、不假接收；成功接口及内部 inserted/duplicate 结果符合支持契约。
- METR-01-AC4 roster 金标断言完整输出全集，完整空日为 0，missing/unsupported 的 not_ready 按契约传播；多学员/日片段去重、负证据、pending、仅在场、跨日补录及非法引用分开验证。周外普通语义错误不影响所选周；跨周重复 ID 使所有涉及日未知，全文件形状错则加载失败。
- METR-01-AC5 撤回最后证据后，分钟及失去最后片段的日/周贡献等于从未提供该证据，不修改埋点或证据存储；另一学员仍可算的行保留，聚合未知不填下界。
- METR-01-AC6 明确选择多快照之一；两段独立集合按金标验证完成/看过/未完成/有无原因剔除。缺选项/重复/悬空引用/状态集合冲突 not_ready；零分母为空，重复完成埋点不影响比例。不发明巩固子集关系。
- METR-01-AC7 Asia/Shanghai 与夏令时 IANA 夹具覆盖午夜、周日到周一与 DST，UTC 时长/当地归日手算一致，边界左闭右开，服务器时区不影响；真实时区历史不由 fixture 推断。
- METR-01-AC8 仓储/CLI 按发生窗：窗外发生而窗内入库不计，窗内发生而窗外入库计入；幂等重试不改发生时间。精确比对 CSV 列、period、空值、reason、比例精度与引号转义，可信 CLI 全身份不削弱领域 self query；候选无输出，模拟与未知清楚，无达标结论。CLI 按 tsc→Node 可运行，production 拒绝、staging 重部署保留事件。

## 7 不变量与合规
属性只取登记；禁止手机号、邮箱、答题正文、对话或密钥。错误 details 只给字段路径/类别，不回显值。身份隔离 tenant/identity；证据/掌握档只由 learner 写、完成判定只由 plan 提供。常量豁免与显式测试夹具路径统一依 foundation，不放宽业务阈值检查。
