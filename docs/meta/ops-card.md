# V3 日常操作卡

> 配套《AI开发文档体系规范》V3.3（docs/meta/doc-system.md）。日常只看这一页；规则的出处写在括号里。所有命令都在仓库根执行，`st` 代表 `python scripts/spec_tool.py`，`ho` 代表 `python scripts/handoff.py`。

## 迁移现状

迁移第 0–3 步已完成。第 4 步（旧文档分拣）与页面深化暂缓（ADR-023）。推进开发按 docs/meta/plan/README.md 执行（ADR-024）：在 Codex 里调用 drive 技能即可定位下一步。

## 开工前

- Codex 从仓库根启动；网页版 Claude 在 claude.ai 的「备考助手·实现」项目里，只看交接包，负责写规格、写计划和写代码；Codex 不起草规格与计划，只出包、机检、复核并用大白话汇报。（ADR-024、ADR-030）
- Claude 项目里只粘贴 docs/meta/plan/templates/claude-project.md 的全文，不上传任何文件；对话里只贴 `ho` 给出的那一句话，要求都写在包里。（ADR-030）
- 一个会话只推进一步。会话之间清空上下文，状态只靠 work 文件、docs/product/calibration.yaml 和 git 传递。（8.3）
- 新机器、新成员、升级工具之后：先跑 `st doctor`；在 Codex 里打开 `/hooks` 信任项目 hooks；装了 Claude Code 的，在里面用 `/memory` 确认看得到 AGENTS.md。（14.1）
- Windows 电脑在 WSL2 里开发，Codex 也在 WSL2 里启动；结果包下载到 Windows 的“下载”文件夹即可，`ho in --latest` 会去那里找；也可以放进 handoff\inbox。结果包不解压、不改名。（ADR-025、ADR-030）

## 先判断走哪条通道

| 通道 | 什么时候 | 怎么做 |
|---|---|---|
| 轻量 | 不改变规格所述行为的修复、重构、补测试、文案微调 | `st rules <路径>` → 改 → `st verify` → 提交 |
| 标准 | 新功能，或改变某一领域内已规定的行为 | 下面的七步 |
| 重型 | 跨领域契约、数据迁移、AI 场景或执行者权限、数据类别与合规、参数语义、领域划分 | 先开 `spec/<ID>` 分支，只改 docs、contracts、design 和 ADR；评审并经冷启动复核后合并；再按标准通道写代码 |

拿不准就按重的一档。（8.1）

## 标准通道七步（README 的 P1、P2）

1. **登记**：功能已在 `roadmap.yaml`（有 `release` 和 `covers`）。新功能用 `st new feature …`，只在主干运行。功能条目不删除，不做的写 `withdrawn: <理由>` 并清空 `covers`。（5.5）
2. **开卡**：open-loop 技能核对在制品与依赖，在 calibration.yaml 的 loops 记开卡。（ADR-008）
3. **规格**：`ho write-specs <闭环>` 按 packages.yaml 出编写包，网页版 Claude 写规格与闭环级任务计划；`ho in --latest L<闭环>-write` 回收，自动跑 gen 与 check，状态 `draft`。
4. **复核**：Codex 用 review-spec 复核，有意见就 `ho write-specs <闭环> --notes <文件>` 退回同一个对话；重型通道再用 `ho specs <闭环>` 请网页版 Claude 新开对话冷启动复核。问题清零后 Codex 写大白话概况，你确认后改为 `ready`。
5. **计划与实现**：在 `feat/<ID>-<短名>` 分支 `st work start <ID>` → 有预写稿用 `ho adopt-plan <ID>` 换入，没有就 `ho write-plan <ID>` 请网页版 Claude 写、`ho in --latest <ID>-plan` 回收 → review-plan 复核 → 你看计划概况回“确认计划” → `ho out <ID>` 出实现包（回到写计划的对话）→ `ho in --latest <ID>` 应用结果并跑 verify。
6. **复查**：Codex 用 review-change 技能对照任务包复查；不过就出修复包（README 的 P3）。
7. **收尾**：`st work close <ID>` → 提交 → CI 全绿后合并（0.1b 接入远端之前：本地 `st verify` 通过后 `git merge --no-ff`，见 README 第 5 节）。闭环的最后一个功能合并后，close-loop 技能核对完成定义并记实际轮次。功能状态由 CI 推导，不手改。

## 页面深化（暂缓，ADR-023）

- 现在没有待深化页；交互细节以页面登记、切片和截图为准。
- 日后要深化某页：该页还没有 `ready` 规格时，列入归档深化清单并标 `refine: pending`，再开 `refine/<页ID>` 分支用 refine-page；已有 `ready` 规格时按标准通道改页面登记，与受影响的规格同一次提交。（W-REFINE-02）
- 开发会话不读深化来源原型，只有 refine-page 读；深化来源的编号、章节号和产品名不进仓库。（E-REFINE-03）
- 条目只在页末追加，序号由工具分配，不手填；删条目只标 `removed: true`；编号基线见 design/screens/ID_BASELINE。（5.4、ADR-023）

## 分期节奏（ADR-008）

- 每个会话开头：drive 技能先运行 `st status`；SessionStart hook 也会提示同一行。
- 同一时间只开一个闭环；开卡用 open-loop，收尾用 close-loop。
- 闭环内：一个功能一条分支，一个会话一个步骤；写规格前看 `st status --loop <闭环>` 里切片的验收句。
- 第一次校准在 1.1 收尾时；每期结束用本期平均“轮／切片”重估下一期，滚动细化 phases.yaml 的预算与切片。
- 熔断：实际轮次超过熔断线就停止加功能，剩余功能移到下一期或主题池。（README 的 P8）
- 进度表 docs/product/progress.md 由 gen 生成，不手改。

## 换工具或换人接手

- 交接只认 `work/<ID>.md`：离开前更新“进度”“决定”“交接记录”“下一步”；接手先完整读它，再 `st pack <ID>`。
- 同一功能同一时间只让一个工具写入；并行时各用各的 worktree。
- 工具私有的计划、记忆、会话记录和网页版 Claude 的对话都不算交接。

## 常用命令

| 命令 | 用途 |
|---|---|
| `st status` / `st status --loop <闭环>` | 当前期、闭环、下一切片；闭环卡 |
| `st pack <ID>` | 生成任务包到 `.pack/<ID>.md` |
| `st pack <ID> --spec-mode` | 写规格阶段的任务包；覆盖页待深化时拒绝生成 |
| `st rules <路径>…` | 零散任务查适用规则 |
| `st verify` | 完成标准（lint、类型、测试、文档检查、相关评测） |
| `st check` | 文档一致性检查 |
| `st gen` | 重新生成派生物（改了约定、skill、参数、路线图之后） |
| `st eval <场景>` | AI 场景评测 |
| `st coverage` | 页面条目覆盖报告 |
| `st new <类型> …` | 分配编号并按模板创建（feature、adr、oq、inv、scenario），只在主干运行 |
| `st budget --tool claude` / `--tool codex` | 预算报告 |
| `st work start <ID>` / `st work close <ID>` | work 文件开始与收尾 |
| `st doctor` | 本地环境检查 |
| `ho write-specs <闭环>` / `ho write-plan <ID>` | 出规格编写包、计划编写包（ADR-030；内容见 packages.yaml） |
| `ho adopt-plan <ID>` | 换入网页版 Claude 的预写计划（docs/meta/plan/work/<ID>.md），检查与回收 PLAN.md 相同 |
| `ho where` | 列出出包位置、结果包的查找位置与记录位置 |
| `ho out <ID>` / `ho specs <闭环>` / `ho in --latest <键>` | 出实现包、出规格冷启动复核包、回收结果包（键：`L<闭环>-write`、`<ID>-plan`、`<ID>`、`L<闭环>-specs`） |
| `ho selftest` | 交接工具自检 |

## 红线

1. 核心领域代码不按考试写分支。
2. 数值阈值只经参数访问器读取，不写字面量。
3. AI 对学员状态只能提议，只有计划引擎能自动顺延。
4. AI 生成内容展示和导出都带标识。
5. 行为变化与规格、契约同一次提交，文档只写现状。
6. 生成物不手改。
7. 改了 `packages/ai/` 就跑对应评测，不低于基线。
8. 依赖与大版本只用 ADR-025 登记的。
9. 仓库里不放任何 CLAUDE.md、CLAUDE.local.md、AGENTS.override.md；AGENTS.md 里不写 `@` 导入。

## AI 出错时（12 章速查）

| 看到 | 修在 |
|---|---|
| 包里没有，AI 去猜了 | 补 refs 或登记 |
| 包里有，AI 没遵守 | 精简、改成可判定的写法，能机检就改成检查 |
| 大量读包外文件 | 补 refs，或拆功能 |
| 两个工具表现不一样 | 把规则移到两边都看得见的载体 |
| 同一错误第二次出现 | 写进 AGENTS.md 易错点（一行），能机检就改成检查 |
| 网页版 Claude 反复犯同一个错 | 写进 docs/meta/plan/templates/claude-project.md，能机检就改成检查 |
| 网页版 Claude 写的规格或计划缺依据、靠猜 | 补 docs/meta/plan/packages.yaml，重新出包；不在对话里零散补发 |
| 记忆里出现项目知识 | 提升进仓库，清掉记忆 |
| 实现时发现页面交互细节缺失 | 按“页面深化”一节补该页，同一次提交更新规格 |
| 仓库里出现深化来源的编号或叫法 | 翻译或删除；把漏掉的模式补进 `[deep_source].forbidden_patterns` |

## 定期

- 每月：doc-garden 巡检；装了 Claude Code 的在里面运行 `/doctor prompt-audit`；看 `st trace-report`。
- 每季度和每次模型大版本升级后：有无对照实测；删掉没有增益的机制和为旧模型打的补丁。
