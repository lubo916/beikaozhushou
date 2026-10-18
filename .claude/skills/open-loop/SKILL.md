---
name: open-loop
description: 闭环开卡：按分期规划开启一个闭环，核对在制品、依赖与页面深化，安排规格并登记校准记录。Open a delivery loop (闭环) by ID. 仅在用户明确调用时使用。
argument-hint: <闭环编号>
disable-model-invocation: true
metadata:
  invocation: manual
  args: <闭环编号>
  generated_from: .agents/skills/open-loop/SKILL.md
  source_sha: 917f6b9ea9fd
---
# 闭环开卡

输入：调用消息中给出的闭环编号，例如 1.3。没有给出就先问。

1. 运行 `python scripts/spec_tool.py status`。上一个闭环未收尾、本期进入条件未满足或已有别的闭环在制时，停下来说明，不开新闭环。
2. 运行 `python scripts/spec_tool.py status --loop <闭环>`，完整阅读闭环卡：一句话演示、新引入的核心、依赖、预算与熔断线（已按校准系数换算）、黄金路径、切片与本闭环不做。
3. 核对：本闭环只引入一个新的核心实体或算法；依赖的闭环都已关上；切片条目所在页没有 refine: pending，有就停下，提示用户先用 refine-page 深化。
4. 列出闭环内还没有规格的功能，按切片顺序提示用户逐个用 write-spec 写规格，再由另一个工具用 review-spec 复核。
5. 在 docs/product/calibration.yaml 为该闭环新增一条记录：loop、opened（今天）、budget（闭环卡上换算后的预算）。运行 `python scripts/spec_tool.py check` 直到通过。
6. 用三句话汇报：本闭环做什么、不做什么、第一个切片是什么。
