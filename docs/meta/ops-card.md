# V3 日常操作卡

> 配套《AI开发文档体系规范》V3.1。日常只看这一页；规则的出处写在括号里。所有命令都在仓库根执行，`st` 代表 `python scripts/spec_tool.py`。

## 迁移期待办（附录 M；迁移完成后删除本节）

按顺序做，每步完成后跑 `st check` 与 `st budget`。

- [ ] 第 0 步 接线：统一工具版本，重写根 AGENTS.md，删除全部 CLAUDE.md 垫片，建 `.agents/skills` 与 `st gen`，关闭两边的私有记忆，配好 hooks、`.githooks` 和 CI 骨架，跑 `st doctor`。
- [ ] 第 1 步 原型抽取与覆盖：先在归档建深化清单，对清单中的页补宽度（深化来源有、合并版原型缺的能力，在该页末尾各补一行条目）并标 `refine: pending`；首次导入就带 `--write-ids`；生成页面登记、切片、截图和 `roadmap.yaml` 候选；`st coverage` 清零 E-COV。
- [ ] 第 2 步 七份 ADR 与跨页口径裁决：以下八项每项只留一个版本——掌握档（含自评怎样生效）、错因、重要度、笔记类型、知识点身份、额度与降级、AI 对话面板归属、题型。
- [ ] 第 3 步 框架与工具：建七份新契约的结构，迁入约定；扩展 pack、rules、check、coverage、budget（含深化闸门、E-COV-05、E-ID-02、E-REFINE 族）；配置 `[deep_source]`；建 refine-page 技能。
- [ ] 第 4 步 旧文档分拣：用 triage-legacy 分拣旧模块文档，完成后删除该技能。
- [ ] 第 5 步 行走骨架："今日清单 → 做题 → 错题回炉"，S18、S19 先完成深化；随后做第一次有无对照。

## 开工前

- 两个工具都从仓库根启动。（4.2）
- 一个会话只做一个任务。会话之间清空上下文，状态只靠 work 文件和 git 传递。（8.3）
- 新机器、新成员、升级工具之后：先跑 `st doctor`；在 Claude 里用 `/memory` 确认看得到 AGENTS.md；在 Codex 里打开 `/hooks` 信任项目 hooks。（14.1）

## 先判断走哪条通道

| 通道 | 什么时候 | 怎么做 |
|---|---|---|
| 轻量 | 不改变规格所述行为的修复、重构、补测试、文案微调 | `st rules <路径>` → 改 → `st verify` → 提交 |
| 标准 | 新功能，或改变某一领域内已规定的行为 | 下面的七步 |
| 重型 | 跨领域契约、数据迁移、AI 场景或执行者权限、数据类别与合规、参数语义、领域划分 | 先开 `spec/<ID>` 分支，只改 docs、contracts、design 和 ADR；评审并经两个工具冷启动复核后合并；再按标准通道写代码 |

拿不准就按重的一档。（8.1）

## 标准通道七步

1. **登记**：功能已在 `roadmap.yaml`（有 `release` 和 `covers`）。新功能用 `st new feature …`，只在主干运行。功能条目不删除，不做的写 `withdrawn: <理由>` 并清空 `covers`。（5.5）
2. **深化**：看它覆盖的页是否标着 `refine: pending`（`st coverage` 会列出）。是就先按下面的"页面深化"做完，再写规格。（5.17）
3. **规格**：write-spec 技能写规格，`st check` 通过，状态 `draft`。
4. **冷启动复核**：换另一个工具，用 review-spec 技能只看任务包提问题；问题清零后由人改为 `ready`。
5. **实现**：在 `feat/<ID>-<短名>` 分支、独立 worktree 中，用 implement-feature 技能。它会依次：读或建 work 文件 → 生成任务包 → 写计划并等你确认 → 实现 → `st verify` → 更新交接。
6. **复查**：换另一个工具，用 review-change 技能对照任务包复查。
7. **收尾**：`st work close <ID>`（把值得保留的决定提升到规格或 ADR，删除 work 文件）→ 提交 → CI 全绿后合并。状态由 CI 推导，不手改。

## 页面深化（5.17）

深化来源原型是归档中交互更深的那份产品原型，路径见 `spec_tool.toml` 的 `[deep_source]`。

1. 开 `refine/<页ID>` 分支，调用 refine-page 技能，给出页 ID。
2. 技能列出口径冲突，由你裁决：界面与交互以深化来源为准，业务口径、数据定义、商业规则以单一事实源为准；要采纳深化来源的业务做法，另走重型通道改单一事实源。
3. 技能改原型（原型冻结时改登记），跑 `st import-prototype --from <路径> --write-ids`；你确认差异只落在这一页。
4. 新条目分到功能；需要新功能时，先在主干 `st new feature …`。
5. 交互要点写进规格草稿，该页 `refine` 改为 `refined`，`st check` 通过，人审后合并。

要守住的几条：

- 开发会话不读深化来源原型，只有 refine-page 读。
- 条目只在页末追加，序号由工具分配，不手填；删条目只标 `removed: true`。（5.4）
- 深化来源的编号、章节号和产品名不进仓库。（E-REFINE-03）
- 已有 `ready` 规格的页不再标 `pending`；之后改这页按标准通道，与受影响的规格同一次提交。（W-REFINE-02）

## 换工具或换人接手

- 交接只认 `work/<ID>.md`：离开前更新"进度""决定""交接记录""下一步"；接手先完整读它，再 `st pack <ID>`。
- 同一功能同一时间只让一个工具写入；并行时各用各的 worktree。
- 工具私有的计划、记忆、会话记录都不算交接。

## 常用命令

| 命令 | 用途 |
|---|---|
| `st pack <ID>` | 生成任务包到 `.pack/<ID>.md` |
| `st pack <ID> --spec-mode` | 写规格阶段的任务包；覆盖页待深化时拒绝生成 |
| `st rules <路径>…` | 零散任务查适用规则 |
| `st verify` | 完成标准（lint、类型、测试、文档检查、相关评测） |
| `st check` | 文档一致性检查 |
| `st gen` | 重新生成派生物（改了约定、skill、参数、路线图之后） |
| `st eval <场景>` | AI 场景评测 |
| `st coverage` | 页面条目覆盖报告，含待深化页及覆盖它们的功能 |
| `st import-prototype --from <路径> --write-ids` | 原型同步到页面登记，写回并分配条目编号 |
| `st new <类型> …` | 分配编号并按模板创建（feature、adr、oq、inv、scenario），只在主干运行 |
| `st budget --tool claude` / `--tool codex` | 预算报告 |
| `st work start <ID>` / `st work close <ID>` | work 文件开始与收尾 |
| `st doctor` | 本地环境检查 |

## 红线

1. 核心领域代码不按考试写分支。
2. 数值阈值只经参数访问器读取，不写字面量。
3. AI 对学员状态只能提议，只有计划引擎能自动顺延。
4. AI 生成内容展示和导出都带标识。
5. 行为变化与规格、契约同一次提交，文档只写现状。
6. 生成物不手改。
7. 改了 `packages/ai/` 就跑对应评测，不低于基线。
8. 仓库里不放任何 CLAUDE.md、CLAUDE.local.md、AGENTS.override.md；AGENTS.md 里不写 `@` 导入。

## AI 出错时（12 章速查）

| 看到 | 修在 |
|---|---|
| 包里没有，AI 去猜了 | 补 refs 或登记 |
| 包里有，AI 没遵守 | 精简、改成可判定的写法，能机检就改成检查 |
| 大量读包外文件 | 补 refs，或拆功能 |
| 两个工具表现不一样 | 把规则移到两边都看得见的载体 |
| 同一错误第二次出现 | 写进 AGENTS.md 易错点（一行），能机检就改成检查 |
| 记忆里出现项目知识 | 提升进仓库，清掉记忆 |
| 实现时发现页面交互细节缺失 | 用 refine-page 补转，同一次提交更新规格；查这页为何没标 `pending` |
| 仓库里出现深化来源的编号或叫法 | 翻译或删除；把漏掉的模式补进 `[deep_source].forbidden_patterns` |

## 定期

- 每月：doc-garden 巡检；Claude 中运行 `/doctor prompt-audit`；看 `st trace-report`。
- 每季度和每次模型大版本升级后：有无对照实测；删掉没有增益的机制和为旧模型打的补丁。

## 分期节奏（ADR-008）

- 每个会话开头：`python scripts/spec_tool.py status`，看当前期、闭环、下一个切片；SessionStart hook 也会提示同一行。
- 开一个闭环：调用 open-loop 技能（WIP＝1，只开一个），它核对依赖与待深化页，并在 docs/product/calibration.yaml 记开卡。
- 闭环内：每个切片一个会话；有功能 ID 的用 implement-feature；写规格前看 `status --loop <闭环>` 里切片的验收句。
- 关一个闭环：调用 close-loop 技能，按完成定义核对，告诉它实际轮次；超过熔断线就熔断，剩余切片移回待办。
- 第一次校准在 1.1 收尾时；每期结束用本期平均“轮／切片”重估下一期，滚动细化 phases.yaml 的预算与切片。
- 进度表 docs/product/progress.md 由 gen 生成，不手改。
