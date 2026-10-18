---
id: PLAT-02
status: draft
refs:
  api: [getParams]
  permissions: [platform.params.read]
  params: [ui.loading.slow_hint_seconds, api.page.max_limit, plan.review.daily_cap]
  adr: [ADR-014]
open_questions:
  - id: OQ-PLAT-02-1
    q: 参数中心（4.6）上线前，运行时取值从哪里覆盖默认值？
    default: 部署环境的覆盖文件，按环境区分；变更随发布记录；本闭环不发布 gray_required 参数的覆盖值
---
# PLAT-02 参数注册与运行时访问器

## 1 目标与边界
阈值、配比、上限统一登记在 contracts/params.yaml，前后端通过 packages/params 的访问器读取同一生效值，每个参数都能查到默认值、可调区间与出处（切片 0.1e，ADR-014）。
本闭环提供注册表、生成访问器、运行时注入、公共读取与共享调整校验；不做后台参数中心、参数写入接口、学员设置界面、灰度发布流程或业务算法。持续集成与预发部署由闭环任务 0.1b 承担。

## 2 业务规则
- R1 参数登记包含 name、owner、description、default、range、unit、tunable_by、learner_range、rollout、reason_required、source_items；gen 从登记生成 packages/params 的 PARAMS、ParamName、ParamValue 与 param(name)，避免登记与代码各有一份参数事实。range 为 null 时不推导数值区间，其他默认值与范围直接引用对应参数登记。（检查 E-SCHEMA-01、E-GEN-01、E-GEN-02）
- R2 未登记的名称在类型检查时被拒绝；绕过类型检查传入未知名称时，访问器也显式报错并指出名称，不调用取值源或返回任何默认值，避免拼写错误被隐藏。已登记参数在取值源未注入、或返回 undefined/null 时返回该参数的登记默认值；这是“没有覆盖值”，不等同于“没有登记”。
- R3 注入取值源提供已登记参数的运行时覆盖值；对有 range 的数值参数，区间内及端点值原样返回，越下界返回下界，越上界返回上界。每次发生钳制都记录可查的诊断告警，包含参数名、原值与生效值，读取继续成功，使配置越界可定位且不突破登记范围；告警不是业务埋点事件。
- R4 共享调整校验先检查 tunable_by；不含 learner 的参数不接受学员调整。对登记了 learner_range 的数值参数，仅接受闭区间内的值；越界返回拒绝结果并给出登记的允许范围，调用方不得保存或将其钳制后视为保存成功，使学员调整有明确反馈。没有 learner_range 的结构参数不据此推导数值调整范围，本闭环不提供其设置流程。
- R5 getParams 返回以登记名称为键的当前生效值对象，每个值与同一运行时取值源下的服务端 param(name) 一致，包括回默认和钳制结果。客户端将成功响应注入访问器后再读取，不自行另配生效值；读取接口失败时不能宣称已取得当前生效参数，避免前后端阈值不一致。
- R6 getParams 按 platform.params.read 提供公共读取，guest 及权限登记的角色可读；读取能力不授予调整参数的权限。覆盖来源按 OQ-PLAT-02-1 的临时默认，需灰度的参数覆盖只走灰度流程，本闭环使用其登记默认值，使部署文件不绕过 ADR-014。
- R7 领域规则中的阈值、配比与上限只经访问器读取。检查 packages/domains 的非测试代码，数值字面量按现有白名单与 param-exempt: <理由> 规则判定；非阈值常量才能注明理由豁免，白名单不作为写死业务阈值的依据，避免参数登记失效。（检查 E-PARAM-01、E-PARAM-03）

## 3 界面
无界面；学员调整的拒绝结果包含可供调用方展示的允许范围，展示与保存界面由所属功能承担。

## 4 数据
无契约例外。getParams 为 GET /params，x-owner: platform，成功响应遵循 contracts/openapi.yaml 的对象结构；权限与数据范围遵循 contracts/permissions.yaml 的 platform.params.read（public）。本功能不定义参数写入接口或持久化表；R4 以共享校验结果验收。
参数元数据与取值依据仅来自 contracts/params.yaml，前端不维护另一个默认值表。部署环境覆盖文件只提供运行时取值，不替代登记的默认值、区间、可调者、生效方式与出处。

## 5 AI 行为
无 AI 场景；参数读取与校验不调用大模型。

## 6 验收
- PLAT-02-AC1 在隔离测试中修改已登记参数的默认值或区间后，未生成时检查报告 E-GEN-01；运行 gen 后 ParamName、ParamValue、PARAMS 与登记一致。逐项读取登记可查到 R1 的完整元数据，source_items 能对应原型条目；手改生成物时检查报告 E-GEN-02。
- PLAT-02-AC2 未注入取值源，以及取值源分别返回 undefined、null 时，读取 ui.loading.slow_hint_seconds 均等于该登记的 default；取值源返回区间内覆盖值时，返回覆盖值，不返回默认值。
- PLAT-02-AC3 用未登记名称调用访问器，类型检查失败；绕过类型检查后调用也显式报错且可辨认参数名，取值源未被调用，没有返回字面量或其他参数的默认值。
- PLAT-02-AC4 对 ui.loading.slow_hint_seconds 与 api.page.max_limit 分别注入低于下界、高于上界的值，返回相应 range 端点，每次钳制均有包含原值、生效值及名称的告警，且读取不因越界失败；两个端点及区间内值保持不变，无钳制告警。
- PLAT-02-AC5 对 plan.review.daily_cap 的共享调整校验，learner_range 两个端点及区间内值通过；低于或高于该范围时均被拒绝，结果含登记的允许范围，不产生可保存的成功结果。学员调整 api.page.max_limit 时因 tunable_by 不含 learner 被拒绝；不以运行时钳制替代调整校验。
- PLAT-02-AC6 在同一取值源下分别构造无覆盖、区间内覆盖和越界覆盖，调用 getParams 后逐项对照服务端 param(name)，值与结构均一致；客户端注入该成功响应后结果一致。接口读取失败时不作为成功响应注入访问器，也不把独立默认值标为当前生效值。
- PLAT-02-AC7 guest 与 platform.params.read 登记的角色均可读取 getParams；覆盖文件不包含 gray_required 参数的覆盖时，这些参数返回登记默认值，且本功能没有可调用的参数修改接口。
- PLAT-02-AC8 在隔离领域代码夹具中放入不在现有白名单内的阈值字面量，检查报告 E-PARAM-03；使用已登记参数访问器后该错误消失。引用未登记参数时报告 E-PARAM-01，非阈值常量带同一行理由豁免时可通过；人工复核没有以白名单或豁免写死阈值。

## 7 不变量与合规
无额外不变量或个人数据处理。参数语义变化按 ADR-014 走重型通道；本规格不以覆盖文件发布需灰度的变更。
