# 实施总纲

> Codex 每次会话先读本文件第 1–3 节，再按第 2 节只读当前步骤所在的文件。
> 本目录只写“怎么推进”：步骤、流程与规格种子；推进记录在 docs/product/calibration.yaml。产品事实以 AGENTS.md“权威来源”为准，冲突时以它们为准（ADR-024）。

## 0 文件

| 文件 | 内容 | 谁读、何时读 |
|---|---|---|
| README.md | 本文件：分工、定位、流程、人工触点 | Codex 每次会话 |
| B0.md | 进入 0 期之前的收尾与切换（现在要做的） | 定位到 B0 时 |
| steps.md | 总步骤表：从 B0 到 7 期的全部步骤 | 你看全局时；Codex 定位时按它的顺序 |
| phase-&lt;n&gt;.md | 每期的假设、期初与期末检查、并行事项、门槛、决策点、关键判断 | 期的边界 |
| loops/&lt;闭环&gt;.md | 闭环的演示、黄金路径、不做、步骤，以及每个功能的覆盖条目与规格种子 | 当前闭环 |
| templates/ | 网页版 Claude 的项目说明、三种任务说明、业务摘要格式 | handoff.py；你建项目时 |
| docs/product/calibration.yaml（不在本目录） | 推进与校准记录：loops 记闭环开卡与收尾（实际轮次），events 记握手、轨道、期初期末、门槛、决策、预授权、熔断 | 开卡、收尾、期末、定位 |

loops/、phase-&lt;n&gt;.md、steps.md 由 phases.yaml、roadmap.yaml、页面登记与分期规划一次生成（生成脚本不在仓库）；此后在期末滚动细化时由 Codex 同步更新。它们和 phases.yaml、roadmap.yaml 不一致时，以后两者为准。

## 1 三方分工

- **你**：业务拍板（规格业务摘要、计划确认、决策单），搬运交接包，真机走查，场外事务（合规、内容授权、招募用户、发布）。
- **Codex**（在仓库根启动）：定位、写规格、做计划、打包、应用结果、verify、复查、提交合并、记录轮次、起草下一步。
- **网页版 Claude**（claude.ai 的「备考助手·实现」项目，开启代码执行与文件创建）：按交接包实现代码与测试；做规格冷启动复核。它看不到仓库，只看交接包。

规格由 Codex 写、Claude 复核；代码由 Claude 写、Codex 复查。如果你装了 Claude Code，P2 的打包、实现、下载三步可以由 Claude Code 在功能分支里直接完成，其余不变。

## 2 定位：现在在哪、下一步做什么

Codex 每次会话按顺序判断，命中即停：

1. 看当前分支。
   - `feat/<ID>-*`：继续该功能。完整读 work/&lt;ID&gt;.md，从“下一步”接着做（P2）。
   - `spec/loop-<闭环>`：继续该闭环的规格批次（P1）。
   - 其他非主干分支：停下来问我。
2. 在主干：先 `git pull`。B0.md 每一步都有可机检的完成判据，有未满足的，就做最前面那一步。
3. B0 全部满足后：运行 `python scripts/spec_tool.py status` 与 `python scripts/spec_tool.py gen`，读 docs/product/roadmap.md 的功能状态和 docs/product/calibration.yaml，按 steps.md 的顺序找第一个没完成的步骤。
   - 期初行（`P<n>-入`）：docs/product/calibration.yaml 里没有该期的 `phase_start` 记录，就做 P7 期初。
   - 并行事项、门槛、决策点（`P<n>-TR`、`-G`、`-D`、`-CAL`）：docs/product/calibration.yaml 里没有对应记录，就提醒我，并做标“Codex”的部分。并行事项不阻塞闭环推进，门槛和决策点阻塞。
   - 规格行（`<闭环>-S`）：闭环里有功能“待写”或“规格中”，就做 P1。
   - 功能行（`<闭环>-<n>`）：取依赖都已完成的第一个未完成功能，做 P2。
   - 收尾行（`<闭环>-C`）：docs/product/calibration.yaml 里该闭环的 loops 记录还没有 closed，就做 P6。
   - 期末行（`P<n>-出`）：做 P7 期末。
4. 只读当前步骤所在的 loops/&lt;闭环&gt;.md、所在期的 phase-&lt;n&gt;.md，或 B0.md。不读其他闭环文件，不读归档。
5. 每次回复我，开头固定四行：

```text
位置：<期> / <闭环> / <步>
本步：<一句话>
你要做的：<拖哪个文件、粘贴哪句话、回复什么；没有就写“无”>
我接下来：<Codex 的下一步>
```

## 3 流程

### P1 闭环规格批次（每个闭环一次）

1. Codex：按 open-loop 技能开卡（核对在制品与依赖，在 docs/product/calibration.yaml 的 loops 新增一条），然后在主干开 `spec/loop-<闭环>`。闭环里每个还没有 ready 规格的功能，按 write-spec 技能写规格。输入是 loops/&lt;闭环&gt;.md 里该功能的规格种子和覆盖条目。
   - 种子里的数字一律改成参数名，并在 contracts/params.yaml 登记。
   - 种子与契约、ADR、glossary 冲突时，以后者为准，种子作废。
   - 每份规格 `check` 通过，状态保持 draft。
2. Codex：运行 `python scripts/handoff.py specs <闭环>`，把它打印的说明原样转给我。
3. 你：在 Claude 项目里新开对话，拖入复核包，粘贴那句话；Claude 给出结果包后下载。
4. Codex：运行 `python scripts/handoff.py in --latest L<闭环>-specs`，逐条处理复核问题。
   - 能从仓库找到答案的直接改。
   - 需要业务判断的列给我。
   - 有修改就再复核一轮，直到“无阻断问题”。
   - 文件头标为“重型”的闭环，Claude 复核后再开 Codex 新会话按 review-spec 复核一次，两边问题取并集。
5. Codex：按 templates/business-summary.md 写业务摘要给我。规则类功能附决策表。
6. 你：回复“确认”，或逐条修改。可以加一句“本闭环计划预授权”。
7. Codex：
   - 把这些规格改为 ready，提交信息写明“业务确认：<日期>”。
   - 运行 `check`，推送并开 PR，CI 绿后合并。
   - 如果你预授权了计划，在 docs/product/calibration.yaml 的 events 记一条 preauthorized。

### P2 功能实现（每个功能一次）

1. Codex：主干 `git pull` 后建分支并生成任务包：
   ```text
   git switch -c feat/<ID>-<短名>
   python scripts/spec_tool.py work start <ID>
   python scripts/spec_tool.py pack <ID>
   ```
   然后在 work 文件“计划”一节写下：
   - 改动文件：逐个路径，新建的也列。
   - 参考文件：Claude 需要看到的现有文件。
   - 契约变更。
   - AC 到测试的映射。
   - 风险。
2. 你：看 Codex 给的五行计划摘要，回复“确认计划”。以下情况 Codex 直接在“确认”行写“预授权（闭环 &lt;L&gt; 业务确认，日期）”，不等你：
   - 本闭环已预授权；
   - 计划没超出任务包的涉及路径；
   - 计划没有规格之外的契约变更。
3. Codex：运行 `python scripts/handoff.py out <ID>`，把它打印的说明原样转给我。
4. 你：在 Claude 项目里新开对话，拖入交接包，粘贴那句话。Claude 给出结果包后下载到默认的“下载”文件夹，回来说“结果已下载”。
5. Codex：运行 `python scripts/handoff.py in --latest <ID>`。它会校验路径、写入文件、运行 gen 与 verify，并在 work 文件里记交接记录、决定和未决。
   - verify 失败：走 P3。
   - verify 通过：按 review-change 技能复查。严重问题走 P3；一般问题当场轻量修。
6. Codex：运行 `python scripts/spec_tool.py work close <ID>`，然后提交、推送、开 PR，CI 全绿后合并，回到主干。

### P3 修复轮

1. Codex：把复查意见写进 `../handoff/log/<ID>-notes.md`，运行 `python scripts/handoff.py out <ID> --notes ../handoff/log/<ID>-notes.md`。
   - 第 2 轮起，包里自动带 FIX.md（verify 输出与复查意见），以及分支上已改文件的当前版本。
2. 你：在同一个 Claude 对话里拖入新包，粘贴那句话。
3. 同一功能超过 3 轮仍不过：Codex 停下，列出原因，建议拆小功能或改规格。

### P4 轻量修改

不改变规格所述行为的修复、重构、补测试、文案微调，Codex 直接做：`rules` → 改 → `verify` → 提交。不经 Claude，不建 work 文件。缺陷修复暴露出规格本身有错时，转 P1 或 P2。

### P5 走查问题与缺陷

你走查发现的问题，由 Codex 判断走哪条通道（轻量、标准、重型）。拿不准按重的一档：轻量走 P4，标准、重型走 P1 加 P2。

### P6 闭环收尾

1. Codex：
   - 运行 `python scripts/spec_tool.py verify --full`，确认本闭环黄金路径和历史黄金路径全绿。
   - 检查用到的页面：加载、空、出错三态都在。
   - 确认没有裸阈值，新增埋点已登记。
2. Codex：生成走查单，包括：
   - 预发地址和测试账号；
   - 按“一句话演示”逐步操作，每步应看到什么，手机 375 宽、桌面 1280 宽各一遍；
   - 各功能“人工把关”里的规则核对与 AI 抽检。
3. 你：照单走一遍，约 10–20 分钟，回复“通过”或问题清单（按 P5 处理）。
4. Codex：按 close-loop 技能补全该闭环在 docs/product/calibration.yaml 的 loops 记录（closed、actual_rounds、claude_rounds）。超过预算上限时，后续闭环按系数上调；超过熔断线时按 P8 处理。

### P7 期初与期末

- **期初**：Codex 按 phase-&lt;n&gt;.md 逐条给进入条件的证据；场外事项由你确认。通过后记 `phase_start`。
- **期末**：
  1. Codex 逐条给出口标准的证据，按门槛清单逐条过。
  2. 你部署到本期受众环，观测指标。
  3. Codex 起草期复盘和下一期调整：新系数、功能切分、规格种子复核。
  4. 你确认后，Codex 修改 phases.yaml 和 roadmap.yaml，同步本目录，记 `phase_end`。

### P8 熔断与校准

- **熔断**：闭环实际轮次超过预算上限的 1.5 倍，就停止加功能。
  - 剩下的功能在主干把 release 往后调（不删除），在 phases.yaml 移到下一期或主题池。
  - 按当前厚度收尾，五要素仍须齐全。
- **校准**：1.1 收尾后，用实测“轮／功能”算出系数，乘到后续预算上。连续两个闭环都在预算内，可以把系数调回。每期末重估一次。
- **轮的口径**：
  - Claude 每完成一个包（出包到回包）算 1 轮。
  - Codex 每完成一个 P1、P2、P6 步骤算 1 轮。
  - handoff.py 把 Claude 轮次记进 work 文件；收尾时 Codex 汇总。

### P9 出错归因

按 docs/meta/ops-card.md“AI 出错时”一表，修在源头。网页版 Claude 反复犯的错，写进 templates/claude-project.md，下一个包起生效；能变成检查的，改成检查。

## 4 你只在这些时候出手

| 时机 | 你做什么 | 大约 |
|---|---|---|
| B0 | 建 Claude 项目；拍板决策单；启动场外轨道 | 一次，1–2 小时 |
| 每个闭环 P1 | 读业务摘要，回“确认”或修改；搬运 1–2 组包 | 15–30 分钟 |
| 每个功能 P2 | 回“确认计划”（预授权时免）；搬运 1–3 组包 | 每组约 2 分钟 |
| 每个闭环 P6 | 真机走查，回“通过”或问题 | 10–20 分钟 |
| 每期 P7 | 场外事项、发布、看指标、确认下一期 | 半天 |
| 门槛与决策点 | phase 文件里标“你”的条目 | 视情况 |

## 5 推进纪律

- 一次只开一个闭环。一个功能一条分支，一个会话只做一个步骤。
- 不读归档：页面深化与旧文档分拣暂缓（ADR-023）。
- 验证以本地 verify 和 CI 为准；Claude 的自测只作参考。
- 计划、规格、交接只认仓库文件：work 文件、规格、本目录。

## 6 九期一览

| 期 | 主题 | 受众环 | 闭环 | 预算（轮） |
|---|---|---|---|---|
| [0](phase-0.md) | 地基与探针 | ring-0 | 4 | 40–63 |
| [1](phase-1.md) | 核心日循环 | ring-1 | 6 | 165–225 |
| [2](phase-2.md) | 自助入门与“学”的闭环 | ring-1+ | 6 | 170–230 |
| [3](phase-3.md) | 测评、预测与考期收尾 | ring-1+ | 6 | 155–215 |
| [4](phase-4.md) | 公开上线门槛 | ring-2 | 7 | 215–285 |
| [5](phase-5.md) | 通用化：任意考试可用 | ring-2 | 8 | 235–315 |
| [6](phase-6.md) | 深度学法 | ring-2 | 7 | 210–280 |
| [7](phase-7.md) | 机构端 MVP | ring-4 | 7 | 215–285 |
| [8+](phase-8.md) | 主题池（6 个主题，不计入 51 个闭环） | ring-2 | — | 不预排 |

到 7 期末合计约 1,400–1,900 轮。0、1 期约 205–290 轮，是第一个能给受邀用户用的版本。
