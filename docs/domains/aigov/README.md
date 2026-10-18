# aigov：AI 治理

## 要点

- 职责：AI 网关（调用、降级、标识、计量）、场景注册与模型路由、执行者台账、提示词版本、评测与监控。
- 场景以 contracts/ai/scenarios.yaml 登记，执行者读写范围以 contracts/ai/actors.yaml 为准；对计划与掌握档只有 planner 能 direct 写（E-AI-03）。
- 提示词以仓库为准，后台只能选择评测通过的版本（ADR-004）；AI 不可用时核心闭环照常（INV-04）。
