---
name: review-spec
description: "复核网页版 Claude 写的规格：冷启动只看任务包，再对照仓库依据核对，列出实现前必须问清的问题。Review specs written by web Claude: cold start plus source check. 仅在用户明确调用时使用。"
argument-hint: <闭环编号或功能ID>
disable-model-invocation: true
metadata:
  invocation: manual
  args: <闭环编号或功能ID>
  generated_from: .agents/skills/review-spec/SKILL.md
  source_sha: 24e9749638d1
---
# 复核规格

输入：调用消息中给出的闭环编号或功能 ID。没有给出就先问。规格由网页版 Claude 编写，Codex 复核（ADR-030）。

1. 冷启动：对每个功能运行 `python scripts/spec_tool.py pack <ID>`，只读包文件。假设马上要实现，列出所有需要问人或只能靠猜的地方。
2. 依据核对：对照仓库里的依据逐条核对，列出与依据冲突、漏掉覆盖条目或切片验收句、重复登记、越出本闭环范围的地方。依据包括契约、ADR、术语、页面登记、算法规格，以及闭环文件的规格种子。
3. 闭环层面：功能之间的接口、数据、事件、参数是否一致；闭环级任务计划与功能规格是否衔接；登记的演示与黄金路径能否由这些功能实现。
4. 每条写明位置（规格的 R、AC 或文件路径）、类别（缺信息、信息冲突、含糊、越界、违反依据）和建议。不提风格建议，不改写规格。没有问题时明确写“无阻断问题”。
5. 结论写进 `../handoff/log/L<闭环>-review-r<n>.md`；单个功能在 P2 中复核时，写进 work/<ID>.md 的“复核”一节。注明执行复核的工具。
6. 有阻断问题：用 write-spec 技能第 5 步退回网页版 Claude。重型通道在 Codex 问题清零后，运行 `python scripts/handoff.py specs <闭环>`，请网页版 Claude 新开对话做冷启动复核，问题与本次取并集。
7. 问题清零后，按 docs/meta/plan/templates/business-summary.md 写大白话概况给用户。
