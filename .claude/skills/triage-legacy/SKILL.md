---
name: triage-legacy
description: 迁移期专用：把旧模块文档的规则细节分拣到规格、约定、ADR 或待定问题。Triage legacy module docs into specs, conventions and ADRs. 仅在用户明确调用时使用，迁移完成后删除。
argument-hint: <旧文档路径>
disable-model-invocation: true
metadata:
  invocation: manual
  args: <旧文档路径>
  generated_from: .agents/skills/triage-legacy/SKILL.md
  source_sha: a6b4b9f35763
---
# 旧文档分拣

输入：调用消息中给出的一份旧模块文档的路径（位于归档 ../exam-prep-archive/legacy-modules/）。

1. 范围以页面登记为准，不新增范围；旧文档只作规则细节的素材，不决定范围，也不作为可引用的来源。
2. 逐条读出旧文档中的规则细节，按去向分拣：属于某个功能的业务规则或验收，写进该功能的规格（规格不存在就按附录 B 建 draft）；跨功能的编码规则，写进对应约定的“规则”；不显然的取舍，提议一份 ADR；无法判断的，登记为待定问题并给临时默认。
3. 与仓库中单一事实源冲突的，以仓库为准，冲突列给人决定。
4. 旧文档的模块编号、章节号与产品名不写进仓库，规则用本仓库的 ID 与术语重写。
5. 无法归属的规则列给人决定。运行 `python scripts/spec_tool.py check`，直到通过。深化来源原型不归本技能处理，见 refine-page。
