# 实施总纲

> Codex 每次会话先读本文件第 1–3 节，再按第 2 节只读当前步骤所在的文件。
> 本目录只写“怎么推进”：步骤、流程、规格种子、交接包的内容规定与预写计划；推进记录在 docs/product/calibration.yaml。产品事实以 AGENTS.md“权威来源”为准，冲突时以它们为准（ADR-024、ADR-030）。

## 0 文件

| 文件 | 内容 | 谁读、何时读 |
|---|---|---|
| README.md | 本文件：分工、定位、流程、人工触点 | Codex 每次会话 |
| B0.md | 进入 0 期之前的收尾与切换 | 定位到 B0 时 |
| steps.md | 总步骤表：从 B0 到 7 期的全部步骤 | 你看全局时；Codex 定位时按它的顺序 |
| phase-&lt;n&gt;.md | 每期的假设、期初与期末检查、并行事项、门槛、决策点、关键判断 | 期的边界 |
| loops/&lt;闭环&gt;.md | 闭环的演示、黄金路径、不做、步骤，以及每个功能的覆盖条目与规格种子 | 当前闭环 |
| packages.yaml | 交接包内容规定：每种包必须带哪些文件、结果能写哪些位置（ADR-030） | handoff.py 组包；要改包的内容时 |
| work/ | 预写计划：闭环级任务的计划（如 0.1b.md）与功能计划的预写稿 | 执行闭环级任务时；出计划编写包时由 handoff.py 附上 |
| templates/ | 网页版 Claude 的项目说明、各种任务说明、大白话概况格式 | handoff.py；你建项目时 |
| docs/product/calibration.yaml（不在本目录） | 推进与校准记录：loops 记闭环开卡与收尾（实际轮次），events 记握手、轨道、期初期末、门槛、决策、预授权、熔断 | 开卡、收尾、期末、定位 |

loops/、phase-&lt;n&gt;.md、steps.md 由 phases.yaml、roadmap.yaml、页面登记与分期规划一次生成（生成脚本不在仓库）；此后在期末滚动细化时由 Codex 同步更新。它们和 phases.yaml、roadmap.yaml 不一致时，以后两者为准。

## 1 三方分工

- **你**：业务拍板（读 Codex 的大白话概况后确认规格与计划，拍板决策单），搬运交接包，真机走查，场外事务（合规、内容授权、招募用户、发布）。
- **网页版 Claude**（claude.ai 的「备考助手·实现」项目，开启代码执行与文件创建）：写规格（每个闭环一批，含闭环级任务的计划）、写计划（每个功能一份）、按确认的计划实现代码与测试；重型通道另做一次规格冷启动复核。它看不到仓库，只看交接包。
- **Codex**（在仓库根启动）：定位；按 packages.yaml 出包；回收结果并写进仓库；机检；用 review-spec 复核规格、用 review-plan 复核计划；复核通过后用大白话把概况讲给你；应用实现结果、verify、用 review-change 复查代码；执行闭环级任务；提交合并、记录轮次、起草下一步。

**规格与计划不由 Codex 起草（ADR-030）。** Codex 发现问题时写成复核意见，退回网页版 Claude，在同一个对话里修改；只有 check 报错已给出明确改法的机械问题（漏列 refs、格式、生成物过期），Codex 可以直接修正并记入复核记录。写与审由不同工具完成：Claude 写的规格与计划由 Codex 复核，Claude 写的代码由 Codex 复查。如果你装了 Claude Code，编写与实现可以由它在仓库里直接完成，其余不变。

## 2 定位：现在在哪、下一步做什么

Codex 每次会话按顺序判断，命中即停：

1. 看当前分支。
   - `feat/<ID>-*`：继续该功能。完整读 work/&lt;ID&gt;.md，从“下一步”接着做（P2）。
   - `spec/loop-<闭环>`：继续该闭环的规格批次（P1）。
   - `chore/<切片>-*`：继续该闭环级任务，按 work/&lt;切片&gt;.md 执行。
   - 其他非主干分支：停下来问我。
2. 在主干：先 `git pull`。B0.md 每一步都有可机检的完成判据，有未满足的，就做最前面那一步。
3. B0 全部满足后：运行 `python scripts/spec_tool.py status` 与 `python scripts/spec_tool.py gen`，读 docs/product/roadmap.md 的功能状态和 docs/product/calibration.yaml，按 steps.md 的顺序找第一个没完成的步骤。
   - 期初行（`P<n>-入`）：docs/product/calibration.yaml 里没有该期的 `phase_start` 记录，就做 P7 期初。
   - 并行事项、门槛、决策点（`P<n>-TR`、`-G`、`-D`、`-CAL`）：docs/product/calibration.yaml 里没有对应记录，就提醒我，并做标“Codex”的部分。并行事项不阻塞闭环推进，门槛和决策点阻塞。
   - 规格行（`<闭环>-S`）：闭环里有功能“待写”或“规格中”，或闭环级任务还没有计划，就做 P1。
   - 闭环级任务行（`<闭环>-T`）：docs/meta/plan/work/&lt;切片&gt;.md 已有计划时，计划写明的“定位判据”在主干上都满足即为完成，否则在 `chore/<切片>-<短名>` 分支上按计划执行；还没有计划的，先做 P1 请网页版 Claude 写（没有规格行的闭环，如 0.4，也这样出包）。由文档体系承担的任务只核对闭环文件中的完成判据。
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

1. Codex：按 open-loop 技能开卡（核对在制品与依赖，在 docs/product/calibration.yaml 的 loops 新增一条），然后在主干开 `spec/loop-<闭环>`，运行 `python scripts/handoff.py write-specs <闭环>`，把它打印的说明原样转给我。
   - 编写包按 packages.yaml 由本闭环的登记推导，恰好够用（doc-system 第 1、2、6 章）。
     - 必读：本闭环与所在期的种子和切片、每个功能的写规格任务包、从文档体系摘出的写作规则、全部约定、术语与已有草稿。
     - 依据：全部契约、设计决定摘要、边界一览、相关规格、涉及页面的登记、切片与截图。按条件附带：算法规格与金标、演示考试、AI 场景资料；有闭环级任务时，另附工程配置与工具。
   - 缺少任何一项不可选的依据，handoff.py 就拒绝出包：补齐来源后重试，不绕过。包内 context/SOURCES.md 列出每个文件的读法与理由。
   - 闭环里已有 ready 规格的功能，包里照样带上，作为一致性的依据。
2. 你：在 Claude 项目里新开对话，拖入编写包，粘贴那句话；Claude 给出结果包后下载。
3. Codex：运行 `python scripts/handoff.py in --latest L<闭环>-write`。它校验写入范围，写入文件，运行 gen 与 check。
   - 机械问题按第 1 节直接修正；其余写进复核意见。
   - 结果包“需要补充的文件”一节列出的路径，下一轮编写包会自动带上。
4. Codex：按 review-spec 技能复核：冷启动（只看任务包）、依据核对（对照契约、ADR、术语、页面登记、种子与切片验收句）、闭环层面（功能之间与闭环级任务的衔接）。
   - 有问题：把复核意见写成文件，运行 `python scripts/handoff.py write-specs <闭环> --notes <文件>`，你拖回同一个对话；回到第 3 步，直到“无阻断问题”。
   - 文件头标为“重型”的闭环：Codex 问题清零后，再运行 `python scripts/handoff.py specs <闭环>`，由你交给网页版 Claude 新开对话做一次冷启动复核；两边问题取并集，按上一条退回修改。
5. Codex：按 templates/business-summary.md 写大白话概况给我。规则类功能附决策表；规划改动（依赖、步骤顺序、分期）与用到的临时默认逐条列出。
6. 你：回复“确认”，或逐条修改（Codex 写成修改意见，按第 4 步退回网页版 Claude）。可以加一句“本闭环计划预授权”。
7. Codex：
   - 把你确认的规划改动（功能依赖、步骤顺序、切片验收句）落到 roadmap.yaml、phases.yaml、闭环文件与 steps.md，运行 gen。
   - 把这些规格改为 ready，提交信息写明“业务确认：<日期>”。
   - 运行 `check`，推送并开 PR，CI 绿后合并。
   - 如果你预授权了计划，在 docs/product/calibration.yaml 的 events 记一条 preauthorized。

### P2 功能实现（每个功能一次）

1. Codex：主干 `git pull` 后建分支、建 work 文件：
   ```text
   git switch -c feat/<ID>-<短名>
   python scripts/spec_tool.py work start <ID>
   ```
   - docs/meta/plan/work/&lt;ID&gt;.md 有网页版 Claude 的预写稿：运行 `python scripts/handoff.py adopt-plan <ID>` 换入（检查与回收 PLAN.md 相同），直接到第 3 步复核。
   - 没有预写稿：运行 `python scripts/handoff.py write-plan <ID>`，把它打印的说明原样转给我。计划编写包带任务包、规格、work 文件、仓库文件清单、本功能涉及路径中的代码、配置与各包入口、依赖功能的规格与闭环级任务计划。
2. 你（只在出了计划编写包时）：在 Claude 项目里新开对话，拖入计划包，粘贴那句话；下载结果包。
3. Codex：出过计划编写包的，先运行 `python scripts/handoff.py in --latest <ID>-plan`，它检查计划的格式、改动范围与 AC 覆盖，把 PLAN.md 写进 work 文件的“计划”一节。然后按 review-plan 技能复核：
   - 有问题：写成复核意见，运行 `python scripts/handoff.py write-plan <ID> --notes <文件>`；出过计划包的，你拖回同一个对话，换入预写稿的，新开对话（包里带着预写稿）。
   - 计划暴露出规格本身的问题：转 P1 修改规格。
4. Codex：复核通过后，按 templates/business-summary.md 的“功能计划”格式，用大白话给我讲计划概况。
5. 你：回复“确认计划”。以下情况 Codex 直接在“确认”行写“预授权（闭环 &lt;L&gt; 业务确认，日期）”，不等你：
   - 本闭环已预授权；
   - 计划没超出任务包的涉及路径；
   - 计划没有规格之外的契约变更。
6. Codex：运行 `python scripts/handoff.py out <ID>`，把它打印的说明原样转给我。
7. 你：回到写计划的那个 Claude 对话（计划是换入的预写稿、没有这样的对话时，新开一个），拖入交接包，粘贴那句话。Claude 给出结果包后下载到默认的“下载”文件夹，回来说“结果已下载”。
8. Codex：运行 `python scripts/handoff.py in --latest <ID>`。它会校验路径、写入文件、运行 gen 与 verify，并在 work 文件里记交接记录、决定和未决。
   - verify 失败：走 P3。
   - verify 通过：按 review-change 技能复查。严重问题走 P3；一般问题当场轻量修。
9. Codex：运行 `python scripts/spec_tool.py work close <ID>`，然后提交、推送、开 PR，CI 全绿后合并，回到主干。

### P3 修复轮

1. Codex：把复查意见写进 `../handoff/log/<ID>-notes.md`，运行 `python scripts/handoff.py out <ID> --notes ../handoff/log/<ID>-notes.md`。
   - 第 2 轮起，包里自动带 FIX.md（verify 输出与复查意见），以及分支上已改文件的当前版本。
2. 你：在同一个 Claude 对话里拖入新包，粘贴那句话。
3. 同一功能超过 3 轮仍不过：Codex 停下，列出原因，建议拆小功能或改规格。

### P4 轻量修改

不改变规格所述行为的修复、重构、补测试、文案微调，Codex 直接做：`rules` → 改 → `verify` → 提交。不经 Claude，不建 work 文件。缺陷修复暴露出规格本身有错时，转 P1 或 P2：规格与计划的修改同样由网页版 Claude 编写、Codex 复核。

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
4. Codex：按 close-loop 技能补全该闭环在 docs/product/calibration.yaml 的 loops 记录（closed、actual_rounds、claude_rounds），并删除 docs/meta/plan/work/ 下本闭环已执行完的计划与预写稿。超过预算上限时，后续闭环按系数上调；超过熔断线时按 P8 处理。

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

按 docs/meta/ops-card.md“AI 出错时”一表，修在源头。网页版 Claude 反复犯的错，写进 templates/claude-project.md，下一个包起生效；因为包里缺依据而出的错，补进 packages.yaml；能变成检查的，改成检查。

## 4 你只在这些时候出手

| 时机 | 你做什么 | 大约 |
|---|---|---|
| B0 | 建 Claude 项目；拍板决策单；启动场外轨道 | 一次，1–2 小时 |
| 每个闭环 P1 | 搬运编写包与结果包（通常 1–3 组）；读大白话概况，回“确认”或修改 | 20–40 分钟 |
| 每个功能 P2 | 搬运计划包（通常 1 组）；读计划概况，回“确认计划”（预授权时免）；搬运实现包（通常 1–3 组） | 每组约 2 分钟 |
| 每个闭环 P6 | 真机走查，回“通过”或问题 | 10–20 分钟 |
| 每期 P7 | 场外事项、发布、看指标、确认下一期 | 半天 |
| 门槛与决策点 | phase 文件里标“你”的条目 | 视情况 |

## 5 推进纪律

- 一次只开一个闭环。一个功能一条分支，一个会话只做一个步骤。
- 规格与计划只由网页版 Claude（或代替它的 Claude Code）编写；Codex 只做第 1 节允许的机械修正。
- 编写包与交接包的内容只按 packages.yaml；网页版 Claude 因缺依据出错时，补 packages.yaml，不在对话里零散补发。
- 不读归档：页面深化与旧文档分拣暂缓（ADR-023）；冻结原型只随规格编写包送达（ADR-030）。
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

## 7 交接包一览

| 包 | 命令 | 键 | 网页版 Claude 交回 | 对话 |
|---|---|---|---|---|
| 规格编写包 | `python scripts/handoff.py write-specs <闭环>` | `L<闭环>-write` | MANIFEST.md 与 files/ | 第 1 轮新开，修改轮回到同一个 |
| 计划编写包 | `python scripts/handoff.py write-plan <ID>` | `<ID>-plan` | PLAN.md | 第 1 轮新开，修改轮回到同一个 |
| 换入预写计划（不出包） | `python scripts/handoff.py adopt-plan <ID>` | — | — | — |
| 实现包、修复包 | `python scripts/handoff.py out <ID>` | `<ID>` | MANIFEST.md 与 files/ | 回到写计划的对话 |
| 规格冷启动复核包 | `python scripts/handoff.py specs <闭环>` | `L<闭环>-specs` | REVIEW.md | 每轮新开 |
| 握手包 | `python scripts/handoff.py out HANDSHAKE --handshake` | `HANDSHAKE` | MANIFEST.md 与 files/ | 新开 |

每个包带什么、结果能写哪些位置，以 packages.yaml 为准；包内 context/SOURCES.md 列出全部文件、读法与理由，以及没有放进包的文件。回收一律用 `python scripts/handoff.py in --latest <键>`。

**粘贴的话固定为一句**：“按压缩包里的 TASK.md 完成 <键> 第 <n> 轮，最后给我 <键>-r<n>-result.zip 的下载链接。”
- handoff.py 出包时会打印这句话，以及该去哪个对话。
- 你不在对话里另加要求：要补充或修改的，告诉 Codex，它写进下一轮包里的 REVISE.md。

**文件放在哪里**（以工作文件夹“备考助手”为例）：

| 文件 | 位置 | 谁放 |
|---|---|---|
| 交接包 `<键>-r<n>.zip` | `备考助手/handoff/outbox/`；handoff.py 打印 Windows 下的完整路径 | Codex |
| 结果包 `<键>-r<n>-result.zip` | 浏览器默认的“下载”文件夹，或 `备考助手/handoff/inbox/`；不解压、不改名 | 你（点下载即可） |
| 回收记录 | `备考助手/handoff/log/`：每轮的 MANIFEST、PLAN、检查输出与“需要补充的文件” | Codex |
| 冻结原型 | `备考助手/exam-prep-archive/prototype/prototype-v1.0.html`；网页版 Claude 要时才附 | 一次放好 |

- `in --latest <键>` 会依次查这些位置：环境变量 HANDOFF_DOWNLOADS 指向的文件夹、“下载”文件夹（WSL2 里也查 Windows 的）、handoff/inbox。浏览器下载到别处的，设一次 HANDOFF_DOWNLOADS 即可。
- 找不到时，它会列出查过的位置和期望的文件名；`python scripts/handoff.py where` 随时列出这些位置。
- Claude 项目里只粘贴 templates/claude-project.md 的全文，不上传任何文件：每次需要的资料都在当次的包里。
