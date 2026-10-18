---
id: PLAT-02
status: draft
refs:
  api: [getParams]
  permissions: [platform.params.read]
  adr: [ADR-014]
open_questions:
  - id: OQ-PLAT-02-1
    q: 参数中心（4.6）上线前，运行时取值从哪里覆盖默认值？
    default: 部署环境的覆盖文件，按环境区分；变更随发布记录
---
# PLAT-02 参数注册与运行时访问器

## 1 目标与边界
代码里找不到写死的阈值：所有阈值、配比、上限都从 contracts/params.yaml 登记，经生成的访问器读取（分期规划 0.1e，ADR-014）。
不做：后台参数中心界面与灰度流程（4.6）。

## 2 业务规则
- R1 packages/params 由 gen 从 contracts/params.yaml 生成，提供按名称读取的类型化访问器。
- R2 运行时取值由注入的取值源提供；没有取值时返回登记的默认值。
- R3 数值取值被夹在登记区间内；越界时记录告警，不报错中断。
- R4 学员可调的参数只能在 learner_range 内设置，超出时拒绝保存并提示允许的范围。
- R5 客户端经 getParams 读取当前生效值，与服务端读到的一致。
- R6 领域规则代码不出现数值字面量（检查 E-PARAM-03），确需常量时在该行注明理由。

## 3 界面
无。

## 4 数据
接口 getParams（x-owner: platform），动作 platform.params.read。取值源为部署环境的覆盖文件（见 OQ-PLAT-02-1）。

## 5 AI 行为
无。

## 6 验收
- PLAT-02-AC1 修改 contracts/params.yaml 后运行 gen，访问器的类型与默认值随之更新；未运行 gen 时检查报 E-GEN-01。
- PLAT-02-AC2 取值源未提供某参数时返回默认值。
- PLAT-02-AC3 取值源给出越界数值时，访问器返回区间端点并记录告警。
- PLAT-02-AC4 学员设置超出 learner_range 的值时保存失败，提示允许范围。
- PLAT-02-AC5 getParams 返回的值与服务端访问器读到的值一致。

## 7 不变量与合规
无。
