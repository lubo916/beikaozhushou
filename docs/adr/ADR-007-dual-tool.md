# ADR-007 双工具适配

- 状态：已采纳；决定 5 的工具组合由 ADR-024 细化

## 背景

同一仓库混用 Claude Code 与 Codex。两者读取指令文件、加载路径规则、调用技能、运行 hooks 的机制不同；只有一边看得见的规则会让两边表现不一致。

## 决定

1. 两个工具共用仓库中的 AGENTS.md；仓库不放 CLAUDE.md、CLAUDE.local.md、AGENTS.override.md、AGENTS.local.md（E-INSTR-01）。
2. 规则送达只依赖两边都可靠的载体：根 AGENTS.md、任务包、rules 与 status 命令的输出、pre-commit 与 CI；Claude 的路径规则只作加速。
3. 技能只放 .agents/skills/，由 spec_tool gen 生成 .claude/skills/ 副本与 agents/openai.yaml，不用软链，不用两个工具的导入功能。
4. 两边的 hooks 只是薄转发，指向同一组脚本（scripts/agent_gate.py、scripts/hooks/）。两边的私有记忆都关闭，纠正一律落到仓库文件。
5. 交接只认 work/<ID>.md；工具最低版本写在 scripts/spec_tool.toml，由 doctor 检查。写规格与写代码由一个工具完成时，冷启动复核与复查由另一个工具完成。

## 后果

- 换工具不换规则，失败可以归因到具体载体。
- Claude 侧的路径规则、手动技能等特性只作加速，不能承载唯一规则。
- 何时重新考虑：两个工具的指令加载机制收敛时，删掉为对方补的部分。
