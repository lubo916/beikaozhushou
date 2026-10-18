---
name: close-loop
description: 闭环收尾：按完成定义核对一个闭环（测试、黄金路径、多端、七态、参数、埋点、发布），记录实际轮次与校准系数。Close a delivery loop (闭环) by ID. 仅在用户明确调用时使用。
metadata:
  invocation: manual
  args: "<闭环编号>"
---

# 闭环收尾

输入：调用消息中给出的闭环编号。没有给出就先问。

1. 运行 `python scripts/spec_tool.py verify`，直到全部通过。确认本闭环的黄金路径测试（标题含 [GP-<n>]）存在且通过，历史黄金路径全部通过。
2. 逐项核对完成定义：全部单元测试与黄金路径通过；手机宽度与桌面宽度各走查一次；加载、空、出错三态可见，用到的离线、受限、数据不足态已处理；阈值都来自参数；新增埋点已登记且北极星口径未被破坏；已部署到本期受众环境且可以回滚。走查与部署由用户确认。任何一项不满足就列出并停下。
3. 在 docs/product/calibration.yaml 补全该闭环的记录：closed（今天）、actual_rounds（用户告诉你）、slices_done；超过熔断线时写 fused 与移回待办的切片。按 status 给出的建议，由用户决定是否修改 coefficient。
4. 值得长期保留的决定提升到规格或 ADR。运行 `python scripts/spec_tool.py gen` 与 `python scripts/spec_tool.py check`，直到通过。
5. 运行 `python scripts/spec_tool.py status`，用三句话汇报：关上了什么、实际轮次与校准系数、下一个闭环。
