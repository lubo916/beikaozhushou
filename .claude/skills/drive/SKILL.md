---
name: drive
description: 推进开发：运行 status 定位当前的期、闭环与步骤，按实施总纲执行下一步，并告诉用户要做什么。Drive the project and run the next step. 触发词：推进、下一步、继续、next step、continue。仅在用户明确调用时使用。
disable-model-invocation: true
metadata:
  invocation: manual
  generated_from: .agents/skills/drive/SKILL.md
  source_sha: c78294e2e7a7
---
# 推进开发

1. 运行 `python scripts/spec_tool.py status`，再读 docs/meta/plan/README.md 第 1–3 节。
2. 按 README 第 2 节定位当前步骤。只读该步骤所在的 docs/meta/plan/B0.md、loops/<闭环>.md 或 phase-<n>.md，不读其他闭环文件，不读归档。
3. 按第 3 节对应的流程执行，直到需要用户动作或确认为止。闭环开卡与收尾分别按 open-loop、close-loop 两个技能完成。规格与计划不由 Codex 起草：P1、P2 中的编写步骤一律用 `python scripts/handoff.py write-specs` 或 `write-plan` 出编写包，回收后按 review-spec、review-plan 复核，再用大白话向用户汇报（ADR-030）。命令一律写成 `python scripts/spec_tool.py …` 或 `python scripts/handoff.py …`。
4. 用第 2 节规定的四行格式回复。需要用户搬运交接包时，原样给出 handoff.py 打印的路径和要粘贴的话。
5. 一个会话只推进一个步骤；完成后先提交，再定位下一步。
