---
name: write-spec
description: 组织一个闭环的规格编写：出编写包给网页版 Claude、回收结果并机检，Codex 不起草规格（ADR-030）。Organize spec writing for a loop through handoff packages. 仅在用户明确调用时使用。
argument-hint: <闭环编号>
disable-model-invocation: true
metadata:
  invocation: manual
  args: <闭环编号>
  generated_from: .agents/skills/write-spec/SKILL.md
  source_sha: 15077bd6528b
---
# 组织规格编写

输入：调用消息中给出的闭环编号，例如 1.3。没有给出就先问。

规格与闭环级任务的计划由网页版 Claude 编写；本技能只负责出包、回收与机检（ADR-030）。装有 Claude Code 并由它代替网页版 Claude 时，它按 docs/meta/plan/templates/task-write-specs.md 在仓库里直接编写，其余步骤相同。

1. 确认闭环已按 open-loop 开卡，当前分支为 `spec/loop-<闭环>`。
2. 运行 `python scripts/handoff.py write-specs <闭环>`。它按 docs/meta/plan/packages.yaml 组包；报缺少依据时先补齐来源或修正 packages.yaml，不绕过。把它打印的说明原样转给用户。
3. 用户说“结果已下载”后，运行 `python scripts/handoff.py in --latest L<闭环>-write`。它校验写入范围、写入文件、运行 gen 与 check。
4. check 报错已给出明确改法的机械问题（漏列 refs、格式、生成物过期），直接修正并记进复核意见文件；改变规则、验收或契约含义的问题，一律写进复核意见。
5. 按 review-spec 技能复核。有意见时运行 `python scripts/handoff.py write-specs <闭环> --notes <复核意见文件>`，请用户拖回同一个对话，回到第 3 步。
6. 结果包“给负责人确认的规划改动”与“未决与风险”两节的内容，原样带进大白话概况；新的 ADR、跨功能待定问题由 Codex 在主干编号后落地。
