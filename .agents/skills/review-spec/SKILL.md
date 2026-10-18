---
name: review-spec
description: "冷启动复核：只看任务包，列出实现前必须问清的问题。Cold-start review of a spec using only its task pack; list blocking questions. 仅在用户明确调用时使用。"
metadata:
  invocation: manual
  args: "<功能ID>"
---

# 冷启动复核

输入：调用消息中给出的功能 ID。没有给出就先问。

1. 运行 `python scripts/spec_tool.py pack <ID>`，只读它输出的包文件，不读仓库中其他文件。
2. 假设马上要实现，列出所有需要问人或只能靠猜的地方。每条写明位置（包的节号或规格的 R、AC 编号）和问题，并标注类别：缺信息、信息冲突、含糊、越界。
3. 不提风格或措辞建议，不改写规格，不扩展需求。
4. 没有问题时明确写“无阻断问题”。
5. 结论写入 work/<ID>.md 的“复核”一节，注明执行复核的工具；没有 work 文件就输出到对话。
