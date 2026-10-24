# CLAUDE.md

本仓库的规则只写在 AGENTS.md（Codex 与 Claude 共用一份）。用 Claude Code 时，下面这一行会把它导入：

@AGENTS.md

本地收尾一并读取 `docs/engineering/acceptance-flow.md`。网页端按新包 `START_HERE` / 接续说明读取包外 `BK_RUNTIME/AGENTS.md`、`acceptance-flow.md` 与 `runtime.json`，在 `repo/` 内用 `python3 ../BK_RUNTIME/bk.py` 执行所有 bk 命令；旧 `repo/tools` 和旧树规则仅保留来源，不作为本轮执行入口。诊断结果不能用于放行。
