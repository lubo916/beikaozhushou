---
name: doc-garden
description: "文档园丁：对照代码查找过期或矛盾的规格、约定与易错点。Doc gardening: find stale or conflicting docs against code. 仅在用户明确调用时使用。"
metadata:
  invocation: manual
---

# 文档园丁

1. 运行 `python scripts/spec_tool.py check --full` 与 `python scripts/spec_tool.py trace-report`。
2. 抽查已完成功能：规格中的 R、AC 与代码和测试是否一致；不一致时以代码和测试为准修改规格，或列为问题。
3. 检查根与端级 AGENTS.md 的易错点近期是否仍在发生；长期没有再出现、或已改成检查的，列为可删除。
4. 检查约定规则是否已由 lint 或 check 实现，已实现的在行尾标注检查编号。
5. 输出只改文档的 PR，或问题清单（每条附文件与依据）。不改代码。
