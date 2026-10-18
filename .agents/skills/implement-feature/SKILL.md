---
name: implement-feature
description: "按功能 ID 实现或修改一个状态为 ready 的功能，遵循任务包与交接文件。Implement a feature by ID using its task pack and work file. 仅在用户明确调用时使用。"
metadata:
  invocation: manual
  args: "<功能ID>"
---

# 实现功能

输入：调用消息中给出的功能 ID，例如 PRAC-02。没有给出就先问。

1. 交接。如果 work/<ID>.md 存在，完整阅读它，从“下一步”继续；不存在就运行 `python scripts/spec_tool.py work start <ID>` 创建。
2. 任务包。运行 `python scripts/spec_tool.py pack <ID>`，完整阅读它输出的包文件。包里的规则就是本任务适用的全部规则。只有包确实缺信息时才读包外文件，并在 work 文件“包外读取”一节记一行原因。
3. 计划。在 work 文件“计划”一节写出要改的文件、契约变更、AC 到测试的映射、风险，然后停下来请用户确认。用户确认之前不改代码和契约。
4. 实现。先写测试（标题带 [<ID>-AC<n>]），再按计划修改。规格或契约需要变时，与代码在同一次提交里一起改，并在 work 文件“决定”一节记一行。遇到规格没覆盖的情形，用待定问题的临时默认；没有临时默认就停下来问。
5. 验证。运行 `python scripts/spec_tool.py verify`，直到全部通过。涉及 AI 场景时，确认相关场景的回归评测达到阈值且不低于基线。
6. 交接。更新 work 文件的进度、决定、交接记录（写明执行这一步的工具）和下一步。
7. 收尾。本功能所在闭环的最后一个功能还要补黄金路径测试（标题含 [GP-<n>]，见 phases.yaml），再交给 close-loop。所有 AC 都有通过的测试后，给“决定”一节每条标去向，运行 `python scripts/spec_tool.py work close <ID>`。它会检查值得长期保留的决定已经提升到规格或 ADR，然后删除 work 文件。
