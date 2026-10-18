---
id: PLAT-02
status: draft
refs:
  api: [getParams]
  permissions: [platform.params.read]
  errors: [COMMON_FORBIDDEN, COMMON_UNAVAILABLE]
  params: [ui.loading.slow_hint_seconds, api.page.max_limit, plan.review.daily_cap, api.request.max_body_bytes]
  adr: [ADR-014, ADR-025, ADR-026, ADR-027]
open_questions:
  - id: OQ-PLAT-02-1
    q: 参数中心（4.6）上线前，运行时从哪里覆盖默认，rollout 为 none 的平台覆盖如何处理？
    default: 服务端启动时一次读取环境覆盖文件并随发布记录；gray_required 和 none 本期固定登记默认，文件出现其键即拒绝。none 是平台覆盖的临时策略，后续所属功能另定学员调整，不推导为学员不可调
---
# PLAT-02 参数注册与运行时访问器

## 1 目标与边界
阈值、配比、上限统一登记在 contracts/params.yaml；生成登记数据，前后端经手写运行时读取平台层参数（切片 0.1e，ADR-014）。本期只读，不实现参数中心、学员调整/保存/叠加、设置界面、灰度或算法；后续参数使用者负责各自调整语义。
先后为 0.1b → PLAT-02 → PLAT-01。共同前置见 docs/meta/plan/loops/0.1-foundation.md：0.1b 交付工作区、生成器迁移、统一错误/身份及工具用例，再交本功能；apps/api 装配和 apps/learner 查询接线归 0.1b 联调，Fastify bodyLimit 经 api.request.max_body_bytes 装配亦归 0.1b。本功能提供实例、启动函数、路由插件及状态订阅，PLAT-01 消费注入结果。

## 2 业务规则
- R1 登记字段与允许值取 contracts/params-validation.yaml，owner 取领域登记 name，unit 保留登记的单复数，不批量改名。0.1b 生成 packages/params/registry.generated.ts 的完整 PARAMS（含 description、sourceItems）、ParamName/ParamValue 和校验元数据；本功能手写 runtime.ts/index.ts 并公开导出，gen 不覆盖手写入口。ParamValue 按 default 递归宽化：数字 number、布尔 boolean、字符串 string；对象保留精确键集，数组为默认长度的逐位只读元组，不从字符串猜枚举。未知名称在类型及运行时均拒绝，错误指出名称且不调用来源，避免误取其他配置。
- R2 登记校验由生成器和运行时遵守同一校验源：字段齐全且无额外字段、name 唯一非空、description 非空、owner/unit/rollout 属于允许值、tunable_by 非空且成员合法无重复、reason_required 严格布尔、source_items 无重复且引用有效页面条目；工程参数可为空出处，description 说明用途。default 为非 null 的数字/布尔/字符串或递归数组/普通对象，数字有限；整数单位清单见校验源，约束全部数字叶子及区间端点，minute/minutes/hours/seconds 是经过时长，允许小数。time_range 为两个合法 HH:mm 字符串，小时与分钟分别有效，不推断先后关系。range 只可为 null 或数值默认对应的两个有限端点，低端不大于高端，默认位于闭区间；learner_range 只可为 null 或 range 的闭子区间，非空时须数值且 tunable_by 含 learner，不要求平台默认落入学员区间。运行时按默认精确形状拒绝缺键、多键、元组长度/叶子类型不符；range 为 null 不猜区间/排序。非法登记生成/构造均失败，使默认自身可用。
- R3 createServerParams({source?, onClamp}) 构造独立实例；source: (name: ParamName) => unknown 为同步来源，构造时逐项只读一次。无来源或已登记项返回 undefined/null 为无覆盖，取登记默认；来源抛错、错型或向 gray_required/none 提供非空覆盖均构造失败并指出名称，不回默认。实例 param(name) 只读冻结快照，getStatus() 恒为 'effective'。合法数值按 range 闭区间钳制；每次读取被钳制项均调用必注入的同步 onClamp: (notice:{name:ParamName;raw:number;effective:number})=>void，端点/区间内不调用。服务端结构化日志接收此诊断，测试收集，不送分析事件；接收器抛错显式失败。结构深拷贝并冻结，不改写登记，避免调用方污染后续读取。
- R4 packages/domains/platform 包入口导出 loadServerParams({env,paramsDir,readFile?,onClamp}) 与 paramsRoutes({params,getContext})。启动函数要求 paramsDir 为绝对目录，env 为 R7 枚举；readFile: (absolutePath:string)=>string 默认同步 UTF-8 读取，可注入隔离读取器；选定文件验证后构造 R3 实例并返回，失败抛出启动错误，日志含路径及可确定的参数名。路由插件只注册 GET /params；apps/api 在启动前解析 repoRoot/服务端 EXAM_PREP_PARAMS_DIR、调用函数再装配插件，路径不取浏览器输入。API 装配归 0.1b，本功能测试函数和插件，避免跨应用写启动逻辑。
- R5 createClientParams() 无 onClamp；提供 param、getStatus、loadSnapshot(snapshot:unknown):void、markFailed():void、subscribe(listener:()=>void):()=>void。状态字面量仅 'unloaded'/'failed'/'effective'，初始 unloaded；unloaded/failed 的 param 取生成默认。unloaded/failed 可 loadSnapshot：全体 ParamName 精确键集及 R2 类型/区间校验通过才原子冻结并转 effective；缺键、多键、undefined/null、错型或越界则整包拒绝、转 failed 并抛 TypeError，不钳制。unloaded 调 markFailed 转 failed；failed 调 markFailed 为幂等空操作，二者可显式重试加载。effective 调 loadSnapshot/markFailed 均抛 Error 且不变更快照，本生命周期不刷新。每次状态变化提交后同步通知订阅者一次，重复状态不通知；取消函数幂等。网络失败由接线调用 markFailed，查询重试设置取共同前置文档；默认值和有效快照状态分开，避免伪装服务端值。
- R6 getParams 为 GET /params（对外 /api/params），成功体是同一服务端实例逐项 param(name) 的全量对象，仅含登记键和值，不含路径、环境变量或理由。公开标记 security: []，匿名映射 guest；platform.params.read 仅允许 guest、learner、org_owner、academic_admin、head_teacher、lecturer、researcher、advisor、platform_ops、system_admin，其他角色 COMMON_FORBIDDEN/403，不因 public 扩权。getContext 不可用或受控故障下实例未装配时为 COMMON_UNAVAILABLE/503；正常启动已冻结快照，不把配置错误延后为成功响应。路由用统一错误体，不暴露启动诊断；无写接口。
- R7 本功能提交 deploy/params/development.json、test.json、staging.json、production.json 四个显式空对象文件。EXAM_PREP_ENV 未设取 development，仅允许这四种；服务端参数目录默认 <repoRoot>/deploy/params，0.1b 解析 EXAM_PREP_PARAMS_DIR 为绝对覆盖目录，镜像基准取共同前置。选定 UTF-8 JSON 对象以参数名为键，缺失/不可读/坏 JSON/非对象/重复键/未知键/错型拒绝启动，不回退环境。immediate 可覆盖，null 为无覆盖；gray_required/none 只要出现键（含 null）即拒绝，遵循 OQ-PLAT-02-1。启动只读一次且不热加载，文件不进浏览器包；0.1b 临时发布记录保存提交及文件摘要，后续 PLAT-03 负责迁移。production 的参数库加载可独立测试；0 期 apps/api 因无正式身份来源在 production 拒绝启动，不能将二者混为一项验收。
- R8 领域阈值、配比、上限只经访问器；E-PARAM-01 拒绝未登记引用，E-PARAM-03 的扫描范围和豁免类别取共同前置，数值白名单仅 0、1、-1。同行 // param-exempt: <具体理由> 仅用于允许的非阈值类别，业务阈值不豁免。生成漂移由 E-GEN-01/02 检查；0.1b/Codex 先交付带 AC1/AC7 标签的隔离 gen/check 用例及生成类型夹具，工具改动不交功能实现者；本功能负责运行时和插件测试，使收尾可执行。

## 3 界面
无界面；外壳用 getStatus 和 subscribe 获知来源状态及新快照，ui 只消费注入值。

## 4 数据
全量平台参数按现有 public 权限只读提供，无表、无学员层。可写 packages/params 非生成文件、packages/domains/platform/**、deploy/params/*.json、tests/**；apps/api 装配不在本功能写入。生成器与生成物归 0.1b；开发身份取共同前置，不做登录。

## 5 AI 行为
无 AI 场景，不调用大模型。

## 6 验收
- PLAT-02-AC1 0.1b 前置带标签工具用例：隔离根修改默认/range 报 E-GEN-01，gen 后数据/类型/校验元数据一致；手改产物报 E-GEN-02。类型夹具覆盖递归对象、逐位元组及未知名，description/sourceItems 完整，工程空出处合法；登记字段、枚举、闭区间关系、计数小数、非法 time_range 各有负例。
- PLAT-02-AC2 服务端无来源、undefined/null 取默认，合法覆盖生效且来源只构造时调用；来源抛错、错型、NaN/Infinity、计数小数、结构错误、非法 HH:mm、受限 rollout 非空覆盖均失败并带名称。分钟/小时合法小数可用，结构不可改写。
- PLAT-02-AC3 未知名绕过类型仍失败且不调用来源；对 ui.loading.slow_hint_seconds、api.page.max_limit 注入区间外合法值，各次读取得端点与完整 onClamp 记录，区间内/端点无告警；诊断接收器抛错不回默认。
- PLAT-02-AC4 按 R5 穷尽状态转换：坏响应整包失败，unloaded/failed 仅默认，重试成功才 effective；网络失败标记、重复 markFailed、effective 非法调用、订阅次数/取消均符合规则；无部分新值或客户端钳制日志。
- PLAT-02-AC5 getParams 在默认/覆盖/钳制时全量逐项等于服务端读取，客户端加载后一致；R6 十个角色及匿名可读，另五个登记角色与未知角色均 403；上下文缺失/实例故障为 503，错误体不泄露路径，无写接口。
- PLAT-02-AC6 注入临时 paramsDir/readFile 逐环境测试选定文件；缺失/坏 JSON/重复键/未知名/错型/受限 rollout 键含 null 均启动函数失败；空对象正常，启动后改文件不热生效，验证四个提交文件为空。production 仅库测试通过，API 拒启动由 0.1b 验收。
- PLAT-02-AC7 0.1b 前置带标签隔离工具用例：阈值字面量报 E-PARAM-03，经登记读取后消失；未知引用报 E-PARAM-01；允许的非阈值类别附同行理由通过，业务阈值不借注释逃逸，理由另作人工复查。

## 7 不变量与合规
参数语义变化按 ADR-014 走重型通道，未接灰度不发布 gray_required 覆盖。考试无关的运行时用同一测试按两套夹具的 exam_id 参数化，断言相同读值、状态与拒绝结果，不把题目/知识点作为运行时输入，也不为考试增加分支；具体夹具入口取共同前置。
