---
name: review-change
description: "对照任务包复查一个功能分支的改动，输出带依据的问题清单。Review a feature branch diff against its task pack. 仅在用户明确调用时使用。"
metadata:
  invocation: manual
  args: "<功能ID>"
---

# 复查改动

输入：调用消息中给出的功能 ID。没有给出就先问。

1. 运行 `python scripts/spec_tool.py pack <ID>` 和 `git diff main...HEAD`，完整阅读两者。
2. 逐条核对：每条 R 与 AC 是否实现，且有标题含 [<ID>-AC<n>] 的测试；契约变更是否与规格在同一次提交；规格引用的不变量是否被遵守，以测试执行的是否有 [INV-<nn>] 测试；领域代码中是否出现未经参数访问器的阈值；AI 输出是否带标识，数字是否只来自算法字段；读取的学员数据是否符合数据类别与可见范围；页面与视图是否实现了登记中列出的状态；证据与掌握档是否只经 learner 写入。
3. 输出问题清单，分严重和一般两级；每条附文件、行号和依据编号（R、AC、INV、约定规则或检查编号）。
4. 用户不要求就不改代码。结论写入 work/<ID>.md 的“复核”一节，注明执行复查的工具。
