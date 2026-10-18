---
id: PLAT-02
status: draft
refs:
  api: [getParams]
  permissions: [platform.params.read]
  errors: [COMMON_FORBIDDEN]
  params: [ui.loading.slow_hint_seconds, api.page.max_limit, plan.review.daily_cap]
  adr: [ADR-014, ADR-025, ADR-026, ADR-027]
open_questions:
  - id: OQ-PLAT-02-1
    q: 参数中心（4.6）上线前，运行时取值从哪里覆盖默认值？
    default: 服务端启动时一次读取部署环境覆盖文件；变更随发布记录；拒绝 gray_required 参数的覆盖
  - id: OQ-PLAT-02-2
    q: 学员调整是否也须理由，且能否直接调整 gray_required 参数？
    default: 遵守 reason_required，须理由时拒绝空白理由；未接入灰度流程前拒绝 gray_required 调整；本期仅校验，不保存
---
# PLAT-02 参数注册与运行时访问器

## 1 目标与边界
阈值、配比、上限统一登记在 contracts/params.yaml；生成登记数据，前后端经同一个手写运行时读取平台层参数（切片 0.1e，ADR-014）。提供只读接口及学员调整的共享校验，不做参数中心、写入接口、设置界面、学员值叠加、灰度流程或算法。
工程先后为 0.1b → PLAT-02 → PLAT-01；依赖 0.1b 的工作区、生成器迁移、公共错误映射与可注入身份。共同前置交付、隔离工具测试调用和闭环接线见 docs/meta/plan/loops/0.1-foundation.md。获取参数与外壳启动事件的联调接线归 0.1b；PLAT-01 只消费注入后的值与状态，未取得时用登记默认继续；本功能负责注入接口与状态。

## 2 业务规则
- R1 登记现有字段为 name、owner、description、default、range、unit、tunable_by、learner_range、rollout、reason_required、source_items，没有 type 字段。0.1b 将现有混合生成文件迁移为 packages/params/registry.generated.ts，产出完整 PARAMS（含 description、sourceItems）、ParamName、ParamValue；本功能在非 GENERATED 的 runtime.ts、index.ts 实现并导出运行时。未知名称在类型及运行时均拒绝，错误可辨认名称，不调用来源。工程参数的 source_items 可为空，以 description 工程说明及 ADR-014 为依据，不虚构原型条目。
- R2 ParamValue 按 default 递归宽化：数字为 number、布尔为 boolean、字符串为 string；对象保留精确键集并递归，数组按默认长度生成逐位只读元组，不从字符串猜枚举。运行时拒绝缺键、多键、数组长度/元素类型不符；数字须有限，unit 为 count/items/cards/learners/level 时还须整数；其他数值含 seconds 可为小数。time_range 须为两个合法 HH:mm 字符串。range 为 null 不推导数值区间；结构只检查形状、叶子类型及上述单位约束，不推断排序等业务规则。登记自身不合法时生成/启动失败，不能靠默认掩盖。
- R3 createServerParams({source?, onClamp}) 创建独立实例；source: (name: ParamName) => unknown 为同步来源，构造时按登记名逐项读取一次并冻结快照。无来源或已登记项返回 undefined/null 表示没有覆盖，采用该项登记默认；来源抛错、错型或给 gray_required 项提供非空覆盖时构造失败并指出名称，API 不启动，不把异常当无覆盖。成功实例提供 param/getStatus，状态 effective；param(name) 只读此快照，不再调用来源。合法数值按 range 闭区间钳制，端点不变；每次读取发生钳制都调用 onClamp({name, raw, effective})，不去重，钳制成功后继续读取。onClamp: (notice: {name: ParamName; raw: number; effective: number}) => void 是必注入的同步诊断接收器，服务端写结构化日志，测试收集记录，不送分析事件；接收器抛错显式抛出，不悄悄回默认。结构取值深拷贝并冻结，不能改写登记或实例。
- R4 validateAdjustment(actor, name, value, reason?) 为无副作用共享函数，本期只支持 learner，其他 actor 返回 UNSUPPORTED_ACTOR。依次检查已登记（UNKNOWN_PARAM）、tunable_by 含 learner（NOT_TUNABLE）、非 gray_required（GRAY_REQUIRED）、数值且 learner_range 非空（UNSUPPORTED_SHAPE）、类型符合 R2（INVALID_TYPE）、在 learner_range 闭区间（OUT_OF_RANGE）、reason_required 时理由去首尾空白后非空（REASON_REQUIRED）。失败返回 {ok:false, code, allowedRange?}，存在 learner_range 时带其区间；通过返回 {ok:true, value}。不钳制、不保存；结构及无 learner_range 参数拒绝。理由/灰度遵从 OQ-PLAT-02-2，学员配置由后续功能接入，不改变平台快照。
- R5 createClientParams({onClamp}) 提供 param、getStatus、loadSnapshot、markFailed。初始 unloaded，param 取生成登记默认；0.1b 的启动接线取一次 getParams，PLAT-01 只消费实例。loadSnapshot 按全体 ParamName 精确键集及 R2 校验，拒绝 undefined/null、错型、未钳制的越界值；任一错误整包拒绝并抛出，状态 failed；成功原子冻结快照，状态 effective（runtime ready）。网络失败由调用方 markFailed；失败时明确以登记默认为初始值。仅 unloaded/failed 允许加载、标记失败或重试；effective 后本次生命周期不刷新或重置。来源状态与默认值分开，不能把默认伪装成服务器值，不另建默认表。
- R6 getParams 为 GET /params（对外 /api/params），返回服务端实例逐项 param(name) 组成的全量只读对象，与同一快照一致；不含覆盖文件路径、环境变量、理由或未登记键。公开标记 security: []，匿名映射 guest；服务端检查 platform.params.read，允许登记的全部角色，其他角色按公共映射返回 COMMON_FORBIDDEN/403。读取不授予调参权限，无修改路由。路由放 packages/domains/platform/api，apps/api 只装配；客户端经契约钩子读取。
- R7 覆盖文件为 UTF-8 JSON 对象，参数名为键，覆盖值为值；只由服务端读取 deploy/params/<env>.json。env 取 EXAM_PREP_ENV，仅允许 development/test/staging/production，未设取 development；启动时加载一次，不热加载。文件缺失、不可读、坏 JSON、非对象、重复键、未知键、错型均拒绝启动，诊断带路径及可确定的名称，不回退其他环境。无覆盖用显式空对象文件，null 仅为无覆盖。gray_required 名称只要出现即拒绝（含 null），此类参数固定登记默认。文件不进浏览器包；变更随代码发布，提交标识及覆盖文件摘要由 0.1b 的 deploy/releases/<release-id>.json 记录。
- R8 领域阈值、配比、上限只经访问器。E-PARAM-01 拒绝未登记引用；E-PARAM-03 检查 packages/domains 非测试代码，数值白名单仅 0、1、-1。非阈值常量可在同一行用 TypeScript 注释 // param-exempt: <具体理由> 豁免，不能借白名单或注释写死业务阈值。生成物漂移由 E-GEN-01/02 检查；工具修改、隔离 gen/check 测试归 Codex，Claude 不改 scripts 或 GENERATED 文件。

## 3 界面
无界面。学员拒绝结果中的范围供所属设置界面展示；外壳是否已取得参数以 getStatus 为准。

## 4 数据
平台快照无学员层或个人数据；全部已登记参数按当前 public 权限只读提供，无表。getParams 契约 additionalProperties 允许值由 R2/R6 精确约束，不透传任意配置。可写路径为 packages/params 的非生成文件、packages/domains/platform/**、apps/api/**、deploy/params/*.json、tests/**；生成器和生成登记数据归 0.1b。开发身份和测试角色切换来自 fixtures/runtime/phase0.json 及共同前置文档，本功能不做登录。

## 5 AI 行为
无 AI 场景，不调用大模型。

## 6 验收
- PLAT-02-AC1 按共同前置文档的隔离工具测试修改默认/range：未生成报告 E-GEN-01，gen 后登记数据/类型一致；手改产物报告 E-GEN-02。description、sourceItems 完整，工程参数允许空出处，非空条目由登记引用检查校验；类型夹具覆盖递归对象与逐位元组，不凭字符串推断枚举。
- PLAT-02-AC2 服务端无来源、来源返回 undefined/null 时取登记默认，区间内覆盖生效；来源仅构造时调用。来源抛错、gray_required 非空覆盖、NaN、Infinity、错型、计数小数、结构缺键/多键/长度错误和非法 HH:mm 均构造失败，无成功快照，错误带名称；结构取值不可被改写。
- PLAT-02-AC3 未登记名称的类型检查失败，绕过类型也失败，来源未被调用。对 ui.loading.slow_hint_seconds、api.page.max_limit 注入低于/高于 range 的合法数值，各次读取得到端点且有完整 onClamp 记录；端点/区间内无告警。接收器抛错显式失败，不返回默认。
- PLAT-02-AC4 plan.review.daily_cap 带非空理由时 learner_range 两端/区间内通过，范围外拒绝并带区间，无成功保存结果。api.page.max_limit、无范围/结构参数、gray_required、空白必需理由、其他 actor、未知名称分别返回 R4 原因码，任何结果不改平台快照。
- PLAT-02-AC5 getParams 在无覆盖、合法覆盖、钳制覆盖时，全量输出逐项等于服务端 param；客户端注入后逐项一致。unloaded/failed 只取登记默认且状态不为 effective；缺键、多键、null、错型、越界响应整包失败，网络失败不注入；重试成功才 effective，不混合部分新值。
- PLAT-02-AC6 匿名和权限登记全部角色可读，其他角色 COMMON_FORBIDDEN/403，无写接口；仅返回登记键，不泄露部署路径。逐环境验证选定文件：缺失/坏 JSON/重复键/未知名/错型/gray_required 键（含 null）均启动失败；空对象正常，gray_required 均为默认，启动后改文件不热生效。
- PLAT-02-AC7 按共同前置文档的隔离领域夹具：阈值字面量触发 E-PARAM-03，换成登记访问器后消失；未登记引用触发 E-PARAM-01，非阈值常量附同一行具体理由可通过。工具用例归 Codex；注释理由的人工复查见第7节。

## 7 不变量与合规
参数语义变化按 ADR-014 走重型通道，未接灰度不发布 gray_required 覆盖。复查不借白名单/豁免藏阈值。按共同前置基线，以 junior-accounting、cet-6 两套考试的画像、知识地图与题目夹具数据驱动复跑；考试无关的参数逻辑可共用测试实现，但不豁免两套夹具覆盖。
