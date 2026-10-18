---
name: review-plan
description: 复核网页版 Claude 写的功能计划：核对改动范围、参考文件、契约变更与 AC 覆盖，并写大白话计划概况。Review a feature plan written by web Claude. 仅在用户明确调用时使用。
argument-hint: <功能ID>
disable-model-invocation: true
metadata:
  invocation: manual
  args: <功能ID>
  generated_from: .agents/skills/review-plan/SKILL.md
  source_sha: 29c94e7880c4
---
# 复核计划

输入：调用消息中给出的功能 ID。没有给出就先问。计划由网页版 Claude 编写，回收后在 work/<ID>.md 的“计划”一节（ADR-030）。

1. 运行 `python scripts/spec_tool.py pack <ID>`，完整阅读任务包和 work 文件的计划。
2. 逐项核对，每条写明依据：
   - 改动文件：都在任务包的涉及路径内，或写明了理由；不含 scripts/、docs/meta/、design/screens/、work/、AGENTS.md 与生成物；写成已有的文件确实存在（`git ls-files`）。
   - 参考文件：都存在；实现要用的现有接口、配置与夹具没有漏。
   - 契约变更：只含规格已写明的；规格没写的转 P1 修改规格。
   - AC → 测试：每条 AC 都有测试，标题带标签，位置符合测试约定；以测试执行的不变量也有。
   - 前置与风险：依赖的功能与闭环级任务都已合入；涉及迁移、参数、多端、AI 场景的另有说明。
3. 有问题：写进 `../handoff/log/<ID>-plan-review-r<n>.md`，运行 `python scripts/handoff.py write-plan <ID> --notes <该文件>`，请用户拖回同一个对话。结论同时记入 work 文件“复核”一节，注明执行复核的工具。
4. 没有问题：按 docs/meta/plan/templates/business-summary.md 的“功能计划”格式写大白话概况，请用户回复“确认计划”。本闭环已预授权、计划没超出涉及路径、也没有规格之外的契约变更时，直接在“确认”一行写“预授权（闭环 <L> 业务确认，日期）”。
