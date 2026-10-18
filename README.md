# 备考助手（exam-prep）

AI 通用备考：学员端、机构端、平台后台。AI 工具的常驻指令见 AGENTS.md；人的日常操作见 docs/meta/ops-card.md；推进开发见 docs/meta/plan/README.md（在 Codex 中调用 drive 技能）；分期与当前进度见 `python3 scripts/spec_tool.py status`。

新机器第一次使用：

```sh
pip install pyyaml
git config core.hooksPath .githooks
python3 scripts/spec_tool.py doctor
python3 scripts/spec_tool.py status
```

归档材料（原型 v1.0、深化来源、旧模块文档、分期规划与实施步骤表）放在同级目录 ../exam-prep-archive，开发会话不读。
