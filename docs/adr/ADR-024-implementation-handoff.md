# ADR-024 实施总纲与交接包

- 状态：已采纳；决定 2 中规格与计划的编写、复核分工由 ADR-030 取代

## 背景

产品负责人只做业务拍板、搬运交接包与真机验收。实现者是网页版 Claude，它看不到仓库；Codex 在仓库根总控。ADR-007 假设两个工具都在仓库里工作，ADR-008 定义了分期、status 命令与校准记录，两者需要接成一条流程。

## 决定

1. docs/meta/plan/ 存放实施总纲：定位规则、流程、各期与各闭环的推进步骤和规格种子。它只写怎么推进；与 AGENTS.md 列出的权威来源冲突时以后者为准，与 phases.yaml、roadmap.yaml 不一致时以后两者为准。
2. 分工：Codex 定位、写规格、做计划、打包、应用结果、验证、复查、提交；网页版 Claude 实现代码与测试，并做规格冷启动复核；产品负责人确认业务摘要与计划、搬运交接包、真机走查。本条细化 ADR-007 决定 5 的工具组合：Codex 写的规格由网页版 Claude 复核，网页版 Claude 写的代码由 Codex 复查。装有 Claude Code 时，它可以代替网页版 Claude 在功能分支上实现，其余不变。
3. 定位：drive 技能先运行 status，再按 docs/meta/plan/README.md 第 2 节定位；闭环开卡与收尾仍由 open-loop、close-loop 两个技能完成。
4. 交接包由 scripts/handoff.py 生成与应用。出包带任务说明、AGENTS.md、任务包、work 文件、ADR-025、ADR-026 与计划列出的文件；回包写入前校验路径、拒绝禁写位置、提示计划外文件，写入后运行 gen 与 verify，并在 work 文件记交接记录、决定与未决。交接仍只认 work 文件。
5. 网页版 Claude 没有 hooks 与私有记忆，规则只经交接包送达；验证的权威是本地 verify 与 CI，它的自测只作参考。
6. 推进记录只有一份：docs/product/calibration.yaml。loops 记闭环开卡与收尾（含实际轮次与网页版 Claude 的轮次），events 记握手、场外轨道、期初期末、门槛、决策点、预授权与熔断。

## 后果

- 人只在业务确认、计划确认、搬运与走查时介入。
- 网页版 Claude 反复出现的错误写进 docs/meta/plan/templates/claude-project.md，能机检的改成检查。
- 何时重新考虑：改用 Claude Code 直接在仓库实现时，交接包可以退役，P1 至 P3 回到 doc-system 第 8 章的标准通道。
