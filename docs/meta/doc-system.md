# 合并版 AI 通用备考 · 面向 AI 开发的文档体系规范 V3

> 版本：V3.3（现行版）　生效：2026-10-19
> 适用：Codex（hooks 可用的版本，建议 ≥ v0.124）在仓库根总控；规格、计划与代码的编写者是看不到仓库、只经交接包工作的网页版 Claude（ADR-024、ADR-030）；也可以在同一仓库内改用 Claude Code（≥ v2.1.283）实现。
> 地位：本规范取代第二册全部内容，以及第一册中关于文档组织与 AI 协作机制的部分。第一册的规划方法（首发范围、节奏、行走骨架）继续有效，二者冲突时以本规范为准。
> 本文只写现状。各项取舍的来由见《V3 综合分析与择优决策》，变更历史见 git。
> 读者是维护文档体系的人。本文存放于 `docs/meta/doc-system.md`，任何入口文件都不引用它；AI 通过 AGENTS.md、任务包、skill 和检查报错获得本规范的要求，只有"修改文档体系本身"的任务才需要读本文。日常操作见《V3 日常操作卡》（docs/meta/ops-card.md），推进步骤见 docs/meta/plan/README.md。

## 目录

1 目标与原则　2 分层与送达　3 事实归属　4 仓库结构　5 文件规格　6 引用与任务包　7 路由　8 工作流程　9 检查与闸门　10 预算　11 验证与维护　12 失败归因　13 写作约定　14 双工具适配
附录 A AGENTS.md 模板　B 功能规格模板　C 页面登记模板　D 新增契约模板　E 不变量初始候选　F 约定模板与页面状态约定　G work 文件模板　H skill 定义　I 工具配置　J spec_tool 命令参考　K 检查规则全表　L 领域划分　M 迁移计划（迁移完成后删除）

---

## 1 目标与原则

目标：在任何一次任务里，Claude Code 和 Codex 拿到的都是同一套最小而充分的事实；几百个功能之间不矛盾，原型给出的范围不遗漏；规则尽量由机器保证，而不是靠 AI 记住。

**P1 一事一址。** 每类事实只有一个可写来源，其余位置只能引用它或由脚本生成。

**P2 只写现状。** 文档描述当前应有的行为，与代码在同一次提交里更新。历史交给 git，理由写进 ADR。

**P3 最小常驻。** 常驻层只放推不出来、且每次会话都需要的内容。每增加一条，都要有度量或真实失败作依据。

**P4 机械送达。** 任务需要的知识由脚本按引用组装成任务包，直接送到工具面前，不依赖 AI 自己决定去读什么。

**P5 两边可见。** 正确性只依赖两个工具都看得见的载体：AGENTS.md、任务包、仓库文件、脚本、pre-commit、CI。工具专属机制只用来加速，不能是任何一条重要规则的唯一载体。

**P6 能机检就不写散文。** 每条"必须/禁止"先问能否变成 lint、check、测试或评测。能变的就变，文档里只留一句话和检查编号。

**P7 报错即反馈。** 检查失败时，报错要写明错在哪、为什么、怎么改，让 AI 读完报错就能自己修正。

**P8 清单结构化。** 清单类事实（路线图、页面登记、术语、不变量、待定问题）用 YAML 作源，不用 Markdown 表格作源；需要给人看的视图由脚本生成。

**P9 派生物只生成。** 生成物不手改；合并冲突时重新生成，不手工合并。

**P10 可度量。** 常驻体量、任务包体量、同时生效的规则条数按工具分别度量；体系本身带来的增益用有无对照实测，没有增益的机制就删掉。

**P11 异构复核。** 一个工具写的规格，由另一个工具做冷启动测试；一个工具写的代码，由另一个工具复查。本仓库的组合见 ADR-030：网页版 Claude 写的规格与计划由 Codex 复核，网页版 Claude 写的代码由 Codex 复查。

**P12 知识只在仓库。** 工具的私有记忆不承载项目知识；所有纠正都落到仓库里的文件。

---

## 2 分层与送达

### 2.1 五层

| 层 | 内容 | 进入上下文的时机 | 载体 |
|---|---|---|---|
| L0 常驻 | 根 AGENTS.md：权威来源、红线、工作方式、命令、易错点、审查规则 | 每次会话开始 | `AGENTS.md` |
| L1 路径 | 约定的"## 规则"节；端、包目录下的 AGENTS.md | 任务涉及对应路径时 | 任务包内的规则摘录；`rules` 命令。Claude 另有自动加载 |
| L2 任务 | 规格全文，以及按引用展开的契约切片、页面登记切片、不变量、待定问题、适用规则 | 执行一个功能 ID 时 | `pack` 生成的任务包 |
| L3 按需 | 约定全文、ADR 全文、算法规格全文、代码 | AI 认为需要时自行读取 | 仓库文件 |
| L4 隔离 | 原型原件、深化来源原型、旧模块文档、合并来历、调研材料 | 永不（例外见 4.1） | 不在开发仓库中 |

### 2.2 送达保证

两个工具都能确定拿到的只有 L0 和 L2。

L1 在 Claude 一侧有自动加载：读写匹配文件时加载 `.claude/rules/` 中的路径规则，用 Read 打开子目录文件时加载该目录的 AGENTS.md。但这依赖"先碰到匹配文件"，做计划时未必已经加载。Codex 没有按路径加载规则的机制，从仓库根启动时也读不到端、包目录下的 AGENTS.md。

因此 L1 的规范送达方式只有两种：任务包携带适用规则的摘录，零散任务运行 `rules` 命令。Claude 的自动加载只算额外提醒，任务包里重复几百字符可以接受。

### 2.3 双工具送达矩阵

| 机制 | Claude Code | Codex | 两边都可靠的载体 |
|---|---|---|---|
| 常驻指令 | 工作目录及以上没有任何 CLAUDE.md、CLAUDE.local.md 时，原生读取工作目录及以上的 AGENTS.md | 从仓库根到启动目录逐级读取，每层一个文件，合计上限 32 KiB | 根 `AGENTS.md` |
| 路径规则 | `.claude/rules/conv-*.md`（生成）在读写匹配文件时加载 | 无 | 任务包的规则摘录；`rules` 命令 |
| 端、包级说明 | 用 Read 打开该目录文件时加载 | 只在启动路径上才加载 | 任务包；`rules` 命令 |
| skill | `.claude/skills/`（生成的副本） | `.agents/skills/`（源） | 同一份正文 |
| 只许手动调用 | `disable-model-invocation: true`，描述不进上下文 | `agents/openai.yaml` 中 `allow_implicit_invocation: false`，描述仍在清单里 | 同一份 `metadata.invocation: manual` |
| 快速反馈 | Stop hook → `scripts/agent_gate.py` | Stop hook → 同一脚本 | pre-commit、CI |
| 会话开始、清空、压缩或恢复时的交接提示 | SessionStart → `session_context.py` | SessionStart → 同一脚本 | `work/<ID>.md` |
| 私有记忆 | 项目设置关闭 auto memory | memories 默认关闭，保持关闭 | 仓库文件 |
| 代码审查规则 | 作为 AGENTS.md 内容读入 | GitHub 审查读取离改动最近的 AGENTS.md 中的"## Code Review Rules" | 同一节 |

网页版 Claude 不在上表中：它看不到仓库，hooks、路径规则、技能与私有记忆对它都不生效，只能经交接包拿到 docs/meta/plan/packages.yaml 按登记推导的最小而充分的文件：写规格时是本闭环的依据，写计划时是任务包与代码现状，实现时是任务包、work 文件与计划列出的文件（scripts/handoff.py，ADR-024、ADR-030）。它反复出现的错误写进 docs/meta/plan/templates/claude-project.md，能机检的改成检查。

---

## 3 事实归属

### 3.1 单一事实源表

| 事实 | 唯一来源 | 形式 | 派生物（只生成） |
|---|---|---|---|
| 范围：有哪些页面、视图、状态，页面要有哪些条目 | `design/screens/<端>/<页ID>.yaml` | YAML | 覆盖报告 |
| 页面深化状态（哪些页待深化） | 页面登记的 `refine` 字段 | YAML | 覆盖报告中的待深化页清单 |
| 条目编号基线 | `design/screens/ID_BASELINE` | 文本 | 无 |
| 功能清单、首发范围、功能覆盖哪些页面条目、依赖 | `docs/product/roadmap.yaml` | YAML | `roadmap.md`（含推导出的状态） |
| 受众环、期、闭环、切片、黄金路径、功能所属的闭环 | `docs/product/phases.yaml` | YAML | `progress.md`；`status` 输出 |
| 闭环开卡与收尾、实际轮次、推进事件、校准系数 | `docs/product/calibration.yaml` | YAML | `status` 中的建议系数 |
| 功能行为 | `docs/domains/<领域>/features/<ID>.md` | Markdown + front matter | 无 |
| 接口、数据结构、人类角色权限、埋点、错误码 | `contracts/` 原有五类；表结构为 `contracts/schema/<领域>.prisma`（0.1b 转换前为 `contracts/schema/*.yaml`，ADR-026） | 原格式；Prisma 多文件 schema | `packages/contract`、数据库客户端 |
| 业务事件（证据等） | `contracts/domain-events.yaml` | YAML | 事件类型 |
| 参数、阈值、开关 | `contracts/params.yaml` | YAML | `packages/params` 类型化访问器；后台参数中心（P19）种子 |
| 数据类别、可见范围、用途限制、保留期限 | `contracts/data-classes.yaml` | YAML | 可见性过滤配置 |
| 指标口径 | `contracts/metrics.yaml` | YAML | 指标字典（P02）种子 |
| 考试画像结构 | `contracts/exam-profile.schema.json` | JSON Schema | 校验器 |
| AI 场景 | `contracts/ai/scenarios.yaml` | YAML | 场景注册（P10）种子 |
| AI 执行者及其读写范围 | `contracts/ai/actors.yaml` | YAML | 行为体台账（P11）种子 |
| 提示词与输出结构 | `packages/ai/<场景>/` | 代码 | 无 |
| 评测用例、判分器、阈值、基线 | `evals/<场景>/` | 数据与代码 | 评测报告 |
| 学习算法 | `docs/models/<模型>.md` | Markdown | 无 |
| 产品不变量与合规义务 | `docs/product/invariants.yaml` | YAML | 无 |
| 术语与禁用同义词 | `docs/product/glossary.yaml` | YAML | 文案扫描规则 |
| 领域划分（代码、名称、组、依赖） | `docs/product/domain-map.yaml` | YAML | 依赖图、各领域归属汇总 |
| 考试差异由谁承载 | `docs/product/variation-points.md` | Markdown | 无 |
| 设计决定 | `docs/adr/ADR-<nnn>-<slug>.md` | Markdown | 无 |
| 待定问题 | 功能级：规格 front matter；跨功能：`docs/product/open-questions.yaml` | YAML | 总索引（按需生成） |
| 编码约定 | `docs/conventions/<名>.md` | Markdown | `.claude/rules/conv-<名>.md` |
| 任务流程 | `.agents/skills/<名>/SKILL.md` | Markdown | `.claude/skills/<名>/`、`agents/openai.yaml` |
| 设计令牌 | `design/tokens.json` | DTCG | 主题样式 |
| 常驻指令 | 根、端、少数包目录下的 `AGENTS.md` | Markdown | 无 |
| 推进步骤、规格种子与交接流程 | `docs/meta/plan/` | Markdown | 无（与 phases.yaml、roadmap.yaml 不一致时以后两者为准） |
| 进行中任务的计划与交接 | `work/<ID>.md` | Markdown | 无（只存在于功能分支） |

### 3.2 归属规则

O1. 每张表、每个业务事件、每个参数、每个 AI 场景都恰好有一个归属领域，写在该条目自己的 `owner` 字段（表写在 schema 中），取值必须是 `domain-map.yaml` 中的领域名。

O2. 学习证据与掌握档归 `learner` 领域。其他领域不直接写这些表，只能调用 learner 的接口提交证据，由 learner 发出 `evidence.*` 业务事件。

O3. 契约文件同时是运行时种子。仓库定义默认值、允许区间和谁可以调；运行时只保存当前取值，且只能落在登记的区间内。

O4. 提示词以仓库为准。后台只能灰度发布仓库中存在、且评测已通过的版本（见 ADR"提示词治理"）。

O5. 范围以页面登记为准。旧模块文档只作为规则细节的素材，不决定范围。

O6. 功能 ID、ADR、INV、跨功能 OQ 的编号只在主干分配。已分配的功能编号与页面条目编号不删除、不复用（E-ID-02、E-COV-05）；条目编号的一次性重置见 5.4。

---

## 4 仓库结构

```text
exam-prep/
├── AGENTS.md                         # L0：两个工具共用的唯一常驻指令（≤ 8 KiB，无 @ 导入）
├── .agents/skills/<名>/              # skill 唯一来源（Codex 原生读取）
│   ├── SKILL.md                      # 只用开放标准字段；正文与工具无关
│   └── agents/openai.yaml            # 生成：Codex 调用策略
├── .claude/
│   ├── settings.json                 # hooks、autoMemoryEnabled: false、权限
│   ├── rules/conv-<名>.md            # 生成：约定"## 规则"摘录（带 paths）
│   ├── rules/claude-code.md          # 可选：极少量 Claude 专属说明（不带 paths，≤ 10 行）
│   └── skills/<名>/SKILL.md          # 生成：复制源 skill 并补 Claude 扩展字段
├── .codex/hooks.json                 # 与 .claude/settings.json 指向同一组脚本
├── .githooks/pre-commit              # 提交底线：spec_tool verify --staged --fast
├── apps/
│   ├── learner/AGENTS.md             # 学员端 S01–S35
│   ├── org/AGENTS.md                 # 机构端 O01–O16
│   ├── admin/AGENTS.md               # 平台后台 P01–P19
│   ├── api/                          # 唯一后端（Fastify），只装配各领域路由（ADR-026）
│   └── worker/                       # 后台任务进程（BullMQ）
├── packages/
│   ├── domains/<领域>/               # 领域代码，与端无关；有不显然的例外时才放 AGENTS.md
│   ├── ui/                           # 组件、页面状态组件、令牌消费
│   ├── params/                       # 生成：参数的类型化访问器
│   ├── contract/                     # 生成：由 openapi.yaml 生成的类型、校验、请求钩子与模拟数据
│   ├── db/                           # 数据库客户端的唯一构造处
│   └── ai/                           # core 为 AI 网关；<场景>/ 放提示词、输出结构、调用代码
├── contracts/
│   ├── openapi.yaml · schema/ · permissions.yaml · events.yaml · errors.yaml
│   ├── domain-events.yaml · params.yaml · data-classes.yaml · metrics.yaml
│   ├── exam-profile.schema.json
│   └── ai/scenarios.yaml · ai/actors.yaml
├── design/
│   ├── tokens.json                   # DTCG 令牌；白标、色觉友好、大字号等主题用 Resolver 表达
│   └── screens/
│       ├── learner/S01.yaml … S35.yaml
│       ├── org/O01.yaml … O16.yaml
│       ├── admin/P01.yaml … P19.yaml
│       ├── ID_BASELINE               # 条目编号基线（ADR-023）
│       ├── slices/<页ID>.html        # 原型单页切片，只作布局参考
│       └── shots/<页ID>/<视图>@<宽度>.png
├── docs/
│   ├── meta/doc-system.md            # 本规范（不被任何入口引用）
│   ├── meta/ops-card.md              # 日常操作卡
│   ├── meta/plan/                    # 实施总纲：推进步骤、规格种子、交接包内容规定与预写计划（ADR-024、ADR-030）
│   ├── product/
│   │   ├── brief.md · journeys.md
│   │   ├── roadmap.yaml              # 源
│   │   ├── roadmap.md                # 生成（只读）
│   │   ├── phases.yaml · calibration.yaml   # 分期与校准（ADR-008）
│   │   ├── progress.md               # 生成（只读）
│   │   ├── glossary.yaml · domain-map.yaml · invariants.yaml · open-questions.yaml
│   │   └── variation-points.md
│   ├── domains/<领域>/
│   │   ├── README.md                 # 领域要点（≤ 1,500 字）
│   │   └── features/<ID>.md          # 功能规格
│   ├── models/                       # learner-model · planner · srs · prediction
│   ├── conventions/                  # 见 5.2
│   └── adr/
├── deploy/                           # Dockerfile、compose 文件、发布与回滚脚本（ADR-026）
├── evals/<场景>/                     # cases/ · graders/ · thresholds.yaml · baseline.json
├── fixtures/exams/<考试ID>/          # 四个演示考试：样板数据、端到端测试、评测种子
├── tests/                            # 含 tests/models/<模型>/ 的金标数据与模拟场景
├── work/<ID>.md                      # 进行中任务的计划与交接，只存在于功能分支
├── scripts/
│   ├── spec_tool.py · spec_tool.toml
│   ├── handoff.py                    # 交接包：出包、回包与自检（ADR-024）
│   ├── agent_gate.py                 # Stop 闸门，两个工具共用
│   └── hooks/session_context.py · hooks/trace.py
└── .gitignore                        # CLAUDE.local.md、AGENTS.override.md、AGENTS.local.md、.pack/、.trace/、work/.plans/
```

本规范路径中的占位符：`<领域>` 指领域名（小写，见 5.12），`<端>` 取 `learner`、`org`、`admin`，`<场景>` 指场景 ID，`<ID>` 指功能 ID。

### 4.1 不在仓库中的东西

原型原件（单文件）、深化来源原型与深化清单（见 5.17）、126 份旧模块文档、合并来历与对两版原型的评述、调研材料，统一放在独立的归档位置（例如 `exam-prep-archive` 仓库），开发仓库不引用、不复制。原型仍在迭代时，按 5.4 的"原型在改"模式由脚本从归档路径读取。AI 任务中按路径读取归档材料的只有两个手动技能：triage-legacy 读旧模块文档，refine-page 读深化来源原型与深化清单；其他任务不读。两者目前暂缓（ADR-023）。另有一个例外：网页版 Claude 写明页面登记、切片与截图缺信息时，规格编写包附上冻结原型，以登记为准（ADR-030）。

### 4.2 启动位置

Codex 与 Claude Code 都从仓库根启动；网页版 Claude 不接触仓库，只经交接包工作（ADR-024）。功能大多同时改领域包和端目录；Claude 的项目设置、hooks 和权限以启动目录为准；Codex 读不到的端、包级说明由任务包补齐。Codex 单包沙箱模式是可选做法，见 14.8。

---

## 5 文件规格

### 5.1 AGENTS.md

根 AGENTS.md 按固定顺序包含七节：项目一句话（≤ 2 行）、权威来源（≤ 12 行，写明什么事实看哪里、冲突以谁为准）、红线（≤ 10 条，每条一句"做什么"加一句"为什么"）、工作方式、命令、易错点（只收录重复出现过的错误，每条一行）、Code Review Rules（≤ 8 条，只放机器查不出来的）。体量 ≤ 8 KiB（UTF-8）。模板见附录 A。

端级 AGENTS.md（`apps/<端>/AGENTS.md`）只有两节："本端要点"（≤ 8 条不显然的例外）和"Code Review Rules"（≤ 5 条），体量 ≤ 3 KiB。包级 AGENTS.md 只在有不显然的例外时才建，体量 ≤ 2 KiB。

所有 AGENTS.md 都不写目录地图，不写能从代码推出的内容，不写 `@路径` 导入（Claude 会展开，Codex 不会，两边上下文就不一样了），不写任何工具专属语法（斜杠命令、`$技能名`、`$ARGUMENTS`、"计划模式"等），引用文件时写"见 <路径>"。

全仓库禁止出现以下文件：`CLAUDE.md`、`.claude/CLAUDE.md`、`CLAUDE.local.md`（任一存在都会让 Claude 改读它们、停读 AGENTS.md）；`AGENTS.override.md`（Codex 会用它替换同目录的 AGENTS.md，Claude 不读，两边规则分叉）；`AGENTS.local.md`（两个工具默认都不读，放了也不生效）。个人偏好放在 `~/.claude/CLAUDE.md` 和 `~/.codex/AGENTS.md`。

### 5.2 约定

位置：`docs/conventions/<名>.md`。固定清单：`api`、`data`、`testing`、`ui`、`ui-states`、`responsive`、`ai-output`、`security`、`copy`、`docs-writing`，以及按端区分的 `end-learner`、`end-org`、`end-admin`。新增约定须经 ADR。

每份约定的 front matter 只有 `applies_to`（glob 列表），正文三节：

- `## 规则`：编号，≤ 15 条，每条可判定对错。已由 lint 或 check 实现的规则在行尾标注检查编号，例如"（lint: no-raw-threshold）"。
- `## 示例`：用本产品的真实对象（页面 ID、参数名）举例。
- `## 理由`：给人看。

只有"## 规则"一节会进入任务包和 `.claude/rules/`。模板见附录 F。

### 5.3 功能规格

位置：`docs/domains/<领域>/features/<ID>.md`，正文 ≤ 6,000 字符（不含 front matter）。

front matter 只放规格自己拥有的字段：`id`、`status`（`draft` 或 `ready`）、`refs`（见 6.1）、`open_questions`（功能级待定问题，每条带临时默认）。标题、领域、首发批次、依赖、覆盖条目都以 `roadmap.yaml` 为准，不在规格里重复。`done` 不由人填写，由脚本推导（见 8.6）。

正文七节：

1. 目标与边界：本功能做什么，明确不做什么。
2. 业务规则：R1、R2……每条可测；默认值写参数名，不写数字。
3. 界面：只写相对于页面登记和 `ui-states` 约定的例外。
4. 数据：只写相对于契约的例外。
5. AI 行为：引用场景 ID，只写本功能特有的约束。
6. 验收：AC 用 Given/When/Then，编号 `<ID>-AC<n>`；AI 部分写评测引用和阈值，不写成确定性断言。
7. 不变量与合规：只列 INV 编号。

粒度：一个功能用 1–3 个会话完成。一页的十几个条目通常归并成两三个功能；原型条目在规格中成为 R 或 AC。模板见附录 B。

### 5.4 页面登记

每页一份 YAML：`design/screens/<端>/<页ID>.yaml`，沿用原型编号（学员端 S01–S35、机构端 O01–O16、平台后台 P01–P19）。字段包括：页面 ID、所属端、标题、模式（引导、沉浸、独立、标准）、目的、深化状态（只在深化清单中的页出现，见 5.17）、视图、适用状态、状态例外、布局要点、读写的数据、AI 在本页的职责（引用场景 ID）、入口与出口、条目列表、切片与截图路径。模板见附录 C。

编号规则：

- 视图：`<页ID>#<视图名>`，如 `S06#first-day`。
- 条目：`<页ID>-<两位序号>`，如 `S18-07`。用序号而不用名称，因为同一页可能有重名条目。序号一经分配不再改动，删除的条目保留编号并标 `removed: true`（E-COV-05）。序号由 `import-prototype` 分配，人和 AI 都不手填；新条目只在该页末尾追加。一次性重置编号须写 ADR 并更改 `design/screens/ID_BASELINE` 的基线标记；E-COV-05 只与基线相同的版本比对（ADR-023）。

每个条目都带 `page_priority`（P0、P1、P2），表示"这一页必须有"的程度。首发范围不看它，看覆盖该条目的功能的 `release`（见 5.5）。

每个条目必须恰好处于以下一种状态：被一个功能覆盖（`roadmap.yaml` 中的 `covers`）；标记 `ui_only: true`（纯界面，无业务逻辑，随页面任务实现）；标记 `out_of_scope: <理由>`。

页面状态的通用集合是七态：正常、加载、空、出错、离线、受限、数据不足；个别页另有锁定态。每页在 `states` 中只列适用的状态，通用表现见 `ui-states` 约定，本页的特殊表现写在 `state_overrides`。

切片与截图：`import-prototype` 从原型中按页切出渲染函数和该页的需求条目，存入 `slices/<页ID>.html`，只作布局参考，公共样式和辅助函数不随切片下发。`shots` 用无头浏览器为每页每个视图按 `spec_tool.toml` 中各端配置的宽度截图（默认学员端 375 与 1280，机构端和后台 1280）。

来源模式二选一，写进 ADR：

- 原型在改：原型文件在归档位置继续迭代，`import-prototype --from <路径> --write-ids` 把稳定编号写回原型并重新生成登记；人审查生成的差异后提交。首次导入就带 `--write-ids`；在此之前，原型中的条目编号由位置决定，编辑原型只许在末尾追加条目，删除只做标记。
- 原型冻结：页面登记成为源，原型原件只归档。

### 5.5 路线图

`docs/product/roadmap.yaml` 每个功能一条，字段为 `id`、`title`、`domain`（领域名）、`release`、`depends`、`covers`；撤销的功能另有 `withdrawn`。

`release` 取 `R1`、`R2`、`R3`、`later`，与期的对应见 5.18（R1 为 0–1 期的功能）。P0/P1/P2 只用于页面条目，不再用于功能。

`covers` 列出本功能覆盖的页面条目。覆盖关系在写规格之前就要确定，这样覆盖检查可以先于规格运行。功能涉及的页面、视图和端都由 `covers` 推出，不另外填写。

路线图不存状态字段。`roadmap.md` 由 CI 在主干上生成，状态按 8.6 推导。

功能条目不删除。撤销的功能写 `withdrawn: <理由>` 并清空 `covers`，编号不复用（E-ID-02）。

### 5.6 契约

原有五类（`openapi.yaml`、`schema/`、`permissions.yaml`、`events.yaml`、`errors.yaml`）中，表结构采用 Prisma 多文件 schema（`schema/<领域>.prisma`，一个领域一个文件；0.1b 转换前为每表一个 YAML，ADR-026），其余格式不变。新增两项要求：表结构中每个字段标注数据类别（三斜线注释；转换前为扩展字段 `x-data-class`）；`events.yaml` 只放埋点，业务事件一律进 `domain-events.yaml`。

新增七份，模板见附录 D：

| 文件 | 内容 | 关键字段 |
|---|---|---|
| `domain-events.yaml` | 业务事件，尤其是证据 | 名称、归属领域、触发方、载荷、消费方、明确不算证据的行为 |
| `params.yaml` | 参数与功能开关 | 名称、归属领域、默认值、区间、单位、谁可调、学员可调区间、是否需灰度、改动是否需写理由 |
| `data-classes.yaml` | 数据类别 | 名称、示例表、各端各角色是否可见、是否需授权、撤回后的处理、禁止用途、保留期限、导出规则、脱敏 |
| `metrics.yaml` | 指标口径 | 名称、定义、公式所在的算法规格、单位、展示位置、归属领域 |
| `exam-profile.schema.json` | 考试画像结构 | 科目与章节结构、题型、计分规则、时长、评分细则引用、及格线 |
| `ai/scenarios.yaml` | AI 场景 | 见 5.7 |
| `ai/actors.yaml` | AI 执行者 | 见 5.7 |

新契约遵循"框架先定、条目随功能追加"：文件和字段结构在迁移时建好，条目只在有功能用到时才登记。

### 5.7 AI 场景、执行者、提示词与评测

`contracts/ai/scenarios.yaml` 每个场景一条：场景 ID（`<领域>.<名称>`，如 `plan.reason_text`）、归属领域、执行者、用途、出现在哪些页面、输入输出结构引用、哪些输出字段的数字只能来自算法、模型档位、AI 点数计量、降级方式与降级文案键、确认方式（无、预览后确认、人工复核）、生成内容标识（显式、隐式、导出时）、读取的数据类别、相关 INV、评测目录、开关与灰度。

`contracts/ai/actors.yaml` 每个执行者一条（如 `tutor`、`planner`、`grader`）：可读的数据类别、可写目标及方式（`direct` 直写、`propose` 只提议、`none`）、可用工具、参与的场景、升级与转人工规则。执行者与人类角色共用 `permissions.yaml` 的动作词表。

提示词与输出结构放 `packages/ai/<场景>/`，随代码版本走。

评测放 `evals/<场景>/`：`cases/` 为用例（含人工金标），`graders/` 为判分器，`thresholds.yaml` 为各指标阈值，`baseline.json` 为当前基线。判分器分代码、模型、人工三类，模型判分须有与人工评分的校准记录。评测分为回归集（每次改动都跑，进 CI）和质量基准（定期跑）。后台"确认的纠错进入评测集"的数据回流到回归集。

AI 场景的完成标准是回归评测达到阈值且不低于基线。"多次独立评分取区间、一致性不达标只给要点"这类要求写成评测阈值，不写成确定性测试。

### 5.8 算法规格

`docs/models/` 下固定四份：`learner-model.md`（证据到六档掌握）、`planner.md`（计划排程）、`srs.md`（记忆稳定度与复习间隔）、`prediction.md`（带校准目标的预测区间）。

每份包含：输入、输出、不变量、决策表或公式、引用的参数名、验收方式。验收方式是 `tests/models/<模型>/` 下的金标数据和模拟场景，例如预测区间的覆盖率目标写成统计检验。功能规格通过 `refs.models` 引用某一节，任务包只取该节。

### 5.9 不变量

`docs/product/invariants.yaml` 每条包含：编号（`INV-<nn>`）、陈述、适用范围、来源（产品决定或法规名称）、执行方式（`test`、`lint`、`check`、`eval`、`review`、`process`）。合规义务也作为不变量登记，来源写法规名称。

测试标题带 `[INV-<nn>]`，复用 AC 覆盖检查。功能规格只引用编号，不复述。初始候选见附录 E。

### 5.10 待定问题

功能级待定问题写在规格 front matter 的 `open_questions`，编号 `OQ-<功能ID>-<n>`，随规格进入任务包，并行分支互不冲突。跨功能问题写在 `docs/product/open-questions.yaml`，编号 `OQ-<nnn>`（主干分配），字段包括涉及的功能、负责人、临时默认、状态。

每条待定问题都必须有临时默认；状态为 `ready` 的规格不能带没有临时默认的待定问题。原型中标为"问题"的条目在迁移时转为待定问题。

### 5.11 ADR

`docs/adr/ADR-<nnn>-<slug>.md`，三节：背景、决定、后果。任务包只取"决定"一节。ADR 记录推不出来的"为什么"，被取代时在新 ADR 中写明取代关系，旧 ADR 不改正文。

### 5.12 术语与领域地图

`glossary.yaml` 每个术语一条：术语、定义、代码标识、禁用同义词（包括合并前各产品的旧叫法）。`copy` 约定中的宣传禁用语（如"保过""必过"）也登记在这里。check 扫描文档与界面文案中的禁用词；任务包自动带上规格正文中命中的术语。

`domain-map.yaml` 每个领域一条：领域代码（大写，即功能 ID 前缀，如 `PLAN`）、领域名（小写，用于目录、场景 ID 和各登记的 `owner` 字段，如 `plan`）、中文名、领域组、依赖的领域。各领域拥有哪些表、业务事件、参数、AI 场景，以各登记条目的 `owner` 字段为准（表的归属写在 schema 中），由脚本汇总成视图，不在这里重复。划分见附录 L 与 ADR-002。

领域 README（`docs/domains/<领域>/README.md`）只有一节"要点"，≤ 1,500 字：领域职责、核心概念、与相邻领域的边界。任务包取这一节。

### 5.13 考试画像与差异点

本产品要做到"通用"，靠的是把考试之间的差异限制在可控的位置。

`variation-points.md` 分三栏列出每类差异由谁承载：由考试画像数据承载（科目结构、题型、计分、时长、评分细则等）；由登记过的扩展点承载（写明扩展点名称和接口）；明确不支持。

考试画像的结构由 `contracts/exam-profile.schema.json` 定义。四个演示考试（初级会计、教师资格、英语六级、自建数据结构期末）放在 `fixtures/exams/<考试ID>/`，同时作为样板数据、端到端测试和评测的种子。

核心领域代码不得按考试写分支（检查编号 E-EXAM-01）。

### 5.14 进行中任务文件

`work/<ID>.md` 是两个工具之间唯一的交接载体。

- 内容：计划（改哪些文件、参考哪些文件、契约变更、AC 到测试的映射、实现要点、风险；由网页版 Claude 编写、Codex 复核，ADR-030）、计划确认记录、会话中做的决定、进度、交接记录（每一步由哪个工具完成）、包外读取、复核结论、未决事项。模板见附录 G。
- 生命周期：`work start <ID>` 创建，随功能分支提交；`work close <ID>` 检查值得长期保留的决定已提升到规格或 ADR，然后删除它。主干上的 `work/` 永远为空。
- 只有标准通道和重型通道需要它；轻量通道不需要。

### 5.15 skill

skill 只放仓库根的 `.agents/skills/`，不建子目录级 skill，因为两个工具发现嵌套 skill 的规则不同。

源 SKILL.md 的 frontmatter 只用开放标准字段（`name`、`description`、`license`、`compatibility`、`metadata`、`allowed-tools`）。是否只许手动调用（`metadata.invocation: manual`）、参数提示（`metadata.args`）写在 `metadata` 中，由 `gen` 转成各工具的字段；`metadata` 的键不复用 frontmatter 字段名。

正文与工具无关：不用 `$ARGUMENTS`，写"调用消息中给出的功能 ID"；不写斜杠命令、`$技能名`、计划模式等工具专属动作，只写要达到的结果；脚本一律写成 `python scripts/spec_tool.py …`。

`description` ≤ 300 字符，开头写用途和触发词，中英文关键词都放。skill 数量保持克制，现行清单见附录 H。

### 5.16 设计令牌

`design/tokens.json` 采用 DTCG 格式。机构白标、色觉友好配色、大字号等用 Resolver 表达为主题，不在令牌中复制几套值。界面代码只使用令牌，不写裸色值和裸尺寸（lint）。

### 5.17 页面深化

当前状态：页面深化暂缓，页面登记中没有 `pending`（ADR-023）。本节是恢复深化时的做法。

部分页面在归档中另有一份交互深得多的产品原型，称为深化来源原型。它的路径、深化清单的路径和它的外部编号模式登记在 `spec_tool.toml` 的 `[deep_source]` 中。

地位：深化来源原型属于 L4，内容转写进合并版原型（原型在改）或页面登记（原型冻结）后才生效。开发会话不读它，只有 refine-page 读。它的页面编号、数据表编号、决定编号、章节号和产品名不进入仓库（E-REFINE-03）。一页转写完成后以合并版原型为准，不再回头比对深化来源。

取舍边界：界面与交互以深化来源为准；业务口径、数据定义、商业规则以第 3 章的单一事实源为准。二者冲突时交人裁决：采纳深化来源的做法，就按重型通道修改单一事实源；不采纳，就丢弃该做法。

深化清单放在归档，每个目标页一行：来源页、深度差距、待裁决的口径冲突、计划在哪个功能之前深化。清单中的页在页面登记里写 `refine: pending`（原型在改模式下写在原型中，由 `import-prototype` 带入），深化完成后改为 `refined`；不在清单中的页不写这个字段。哪些页待深化只看这个字段，清单不另记状态。

三个时点：

| 时点 | 做什么 | 落在哪里 |
|---|---|---|
| 页面列入深化清单时 | 宽度补齐：深化来源中有、合并版原型缺的能力，在该页末尾各追加一行条目；标 `refine: pending`；裁决该页牵涉的跨页口径 | 合并版原型；第 3 章的单一事实源 |
| 该页第一个功能写规格之前 | 用 refine-page 深化该页：新增条目、视图、布局要点、状态例外、AI 职责，以及各条目的交互要点 | 合并版原型或页面登记；功能规格草稿 |
| 每个功能写规格时 | 把规格草稿中的交互要点定稿为 R 与 AC | 功能规格 |

跨页口径（被多页共用的定义，如掌握档、错因分类）在列入清单时就裁决，不等到深化该页时，因为先开发的页会把它们写进表结构。

闸门：覆盖条目所在页为 `pending` 时，`pack --spec-mode` 拒绝生成，规格不能改为 `ready`（E-REFINE-01）。已有 `ready` 规格的页不再标 `pending`；此后对该页的修改按"改变已规定的行为"走标准通道，与受影响的规格同一次提交（W-REFINE-02 列出受影响的功能）。

写法：

- 条目只在该页末尾追加，序号由 `import-prototype` 分配。一项可独立覆盖的能力一个条目；按钮、状态、边界等细节写进交互要点，不单列条目。
- 深化来源中的子面板、弹层做成视图，各视图按 5.4 截图，视觉细节靠截图承载。切片会进入任务包，保持精简。
- 交互要点写进覆盖该条目的功能规格草稿，只写行为；数值写"由参数决定"，参数在写规格时登记；不写深化来源的编号与叫法。
- 深化在 `refine/<页ID>` 分支上进行，人审差异后合并；需要的新功能编号先在主干分配。

### 5.18 分期与校准

`docs/product/phases.yaml` 是受众环（ring-0 至 ring-4）、期、闭环、切片、黄金路径、轨道、路线变体与风险的唯一来源；功能所属的闭环只记在这里。release 与期的对应：R1 为 0–1 期，R2 为 2–3 期，R3 为 4 期，later 为 5 期及以后。切片的条目必须由同一闭环的功能覆盖（E-PHASE-05），切片的验收句是功能 AC 的种子。

`docs/product/calibration.yaml` 记闭环开卡与收尾（loops：实际轮次、网页版 Claude 轮次、熔断）、推进事件（events：握手、场外轨道、期初期末、门槛、决策、预授权）与校准系数。`status` 由路线图、分期、校准与规格状态推导当前位置，`progress.md` 由 `gen` 生成。同一时间只开一个闭环，开卡与收尾用 open-loop、close-loop 两个技能（ADR-008、ADR-024）。

---

## 6 引用与任务包

### 6.1 手写的 refs

规格 front matter 的 `refs` 只列下表中的类型，每类是一个 ID 列表：

| 类型 | 指向 | 任务包取什么 |
|---|---|---|
| `api` | `openapi.yaml` 的 operationId | 该操作的请求、响应和错误定义 |
| `schema` | `schema/` 的表名 | 表定义、字段数据类别、归属领域 |
| `permissions` | `permissions.yaml` 的动作 | 动作、允许的角色、条件 |
| `events` | `events.yaml` 的埋点名 | 埋点定义 |
| `errors` | `errors.yaml` 的错误码 | 错误码、文案键、状态码 |
| `domain_events` | `domain-events.yaml` 的事件名 | 载荷、触发方、消费方 |
| `params` | `params.yaml` 的参数名 | 默认值、区间、谁可调、灰度要求 |
| `data_classes` | `data-classes.yaml` 的类别 | 可见范围、授权、禁止用途、保留 |
| `metrics` | `metrics.yaml` 的指标 | 口径、公式引用、展示位置 |
| `ai` | `ai/scenarios.yaml` 的场景 | 场景全文、所用执行者的条目、评测阈值 |
| `models` | `docs/models/<模型>.md#<节>` | 该节全文 |
| `inv` | `invariants.yaml` | 不变量原文 |
| `features` | 依赖的功能 ID | 依赖功能规格第 1 节首段及其 `refs.api` |
| `adr` | ADR 编号 | "决定"一节 |

### 6.2 自动推出的内容（不手写）

以下内容由 `pack` 自动推出，规格里不写：

- 页面：由 `roadmap.yaml` 的 `covers` 推出涉及的页面、视图和条目，取页面登记的相关部分、切片和截图路径。
- 涉及路径：本领域包 `packages/domains/<领域>/**`；由页面前缀推出的端目录 `apps/<端>/**`；`refs.ai` 对应的 `packages/ai/<场景>/**` 和 `evals/<场景>/**`；`tests/**`。
- 适用规则：`applies_to` 与涉及路径相交的约定，取其"## 规则"节。
- 端、包级说明：涉及路径上的各级 AGENTS.md（根 AGENTS.md 已常驻，不重复）。
- 术语：规格正文中命中的 glossary 词条及其禁用同义词。
- 领域要点：本领域 README 的"要点"一节。
- 待定问题：本功能的 `open_questions`，以及 `open-questions.yaml` 中涉及本功能的条目。
- 测试现状：每条 AC 对应的测试文件及最近一次结果。

### 6.3 任务包

`python scripts/spec_tool.py pack <ID>` 把任务包写到 `.pack/<ID>.md`（已忽略提交），并在终端输出路径和体量。包的结构固定：

```text
# 任务包 <ID> <标题>（由 <commit> 生成，勿手改）
0 读法与体量
1 规格全文（去掉 refs 列表）
2 适用规则（约定规则摘录 + 端、包级 AGENTS.md）
3 契约切片（api / schema / permissions / events / errors / domain_events）
4 参数与数据类别
5 AI 场景、执行者与评测阈值
6 页面（登记切片 + 原型切片 + 截图路径）
7 不变量
8 依赖功能的接口摘要
9 术语
10 相关 ADR 的决定
11 待定问题与临时默认
12 AC 与测试现状
```

体量上限见第 10 章。超出时 `pack` 以非零状态退出，并列出最大的几块。超预算说明功能涉及面太宽，应当拆分；确需保留时由人决定并记入 work 文件，再用 `--allow-over` 生成。

`pack <ID> --spec-mode` 用于写规格阶段：规格尚不存在时，输出 roadmap 条目、覆盖的页面条目、相关契约现状、相关 INV 和待定问题。覆盖条目所在页的 `refine` 为 `pending` 时，它以非零状态退出，提示先用 refine-page 完成该页深化（见 5.17）。

---

## 7 路由：AI 怎样拿到规则

1. **任务包（首选）。** 有功能 ID 的任务一律先生成任务包。包里的规则就是本任务适用的全部规则，AI 不必再读约定全文。
2. **`rules` 命令（零散任务）。** 没有功能 ID 的修改，先运行 `python scripts/spec_tool.py rules <要改的路径>…`，输出这些路径适用的约定规则和各级 AGENTS.md。根 AGENTS.md 只用一句话交代这条路由，不放路由表。
3. **Claude 自动加载（加速）。** `.claude/rules/conv-*.md` 由约定生成，带 `paths`，Claude 读写匹配文件时自动加载。这只是额外提醒，任何规则都不能只依赖它送达。
4. **闸门报错（兜底）。** 能机检的规则在 Stop 闸门、pre-commit 和 CI 中检查，报错写明出处和改法。

---

## 8 工作流程

### 8.1 变更分三条通道

| 通道 | 适用情形 | 流程 |
|---|---|---|
| 轻量 | 不改变规格所述行为的修复、重构、补测试、文案微调 | `rules <路径>` → 修改 → `verify` → 提交。不建 work 文件，不需要计划确认 |
| 标准 | 新功能，或改变某一领域内已规定的行为（可含该领域的页面） | implement-feature 全流程（8.2）；规格、契约与代码在同一次提交里更新 |
| 重型 | 跨领域的契约变更；数据迁移；新增或修改 AI 场景、执行者权限；数据类别、可见范围或合规相关变更；参数语义变化；领域划分变化 | 规格先行：第一个 PR 只改 `docs/`、`contracts/`、`design/`、ADR，以及 AI 场景的评测用例与阈值（`evals/`），经人评审并完成异构冷启动复核后合并；然后按标准通道写代码 |

拿不准时按重的一档处理。缺陷修复如果暴露出规格本身有错，转入标准通道。

### 8.2 功能生命周期

1. 登记：在 `roadmap.yaml` 中新建功能（主干分配 ID），确定 `release` 和 `covers`。
2. 深化：覆盖条目所在页的 `refine` 为 `pending` 时，先用 refine-page 完成该页深化（见 5.17）。在此之前 `pack --spec-mode` 拒绝生成，规格也不能改为 `ready`（E-REFINE-01）。
3. 写规格：网页版 Claude 按规格编写包写，状态为 `draft`；Codex 用 write-spec 技能出包与回收，`check` 通过（ADR-030）。
4. 复核：Codex 用 review-spec 技能复核（冷启动只看任务包，再对照依据核对）；重型通道另由网页版 Claude 新开对话做一次冷启动复核，问题取并集。问题清零、人确认大白话概况后，状态改为 `ready`。
5. 计划与实现：开工时网页版 Claude 按计划编写包写 work 文件的计划（已有它的预写稿时，Codex 用 `handoff.py adopt-plan` 换入），Codex 用 review-plan 复核，人确认；再按计划实现（implement-feature），1–3 个会话完成。
6. 复查：由另一个工具用 review-change 技能对照任务包复查改动。
7. 合并：`work close` 后提交，CI 全量通过后合并。
8. 完成：由脚本推导，见 8.6。

### 8.3 会话纪律

- 一个会话只做一个任务。
- 新功能或改变已规定的行为，先把计划写进 work 文件，人确认后才改代码和契约。需要硬约束时，计划阶段用工具的只读模式启动（见 14.6）。
- 会话之间清空上下文，状态只靠 work 文件和 git 传递。
- 会话开始、清空、压缩或恢复时，SessionStart hook 会提示当前分支对应的 work 文件；AI 应先重读它，再用 `pack` 重新生成任务包。

### 8.4 跨工具交接

同一个功能可以由不同工具接力完成，常见组合是一个出计划、另一个实现，或者一个实现、另一个复查。交接规则只有三条：

- 交接只认 work 文件。离开的一方更新"进度""决定""交接记录""下一步"；接手的一方先完整阅读它。
- 同一个功能在同一时间只由一个工具写入。
- 工具私有的计划文件、记忆、会话记录都不算交接。

### 8.5 并行开发

一个功能对应一个分支、一个 git worktree。分支命名为 `feat/<ID>-<短名>`、`fix/<短名>`、`spec/<ID>`（重型通道的规格先行 PR）、`refine/<页ID>`（页面深化，见 5.17）。不同工具并行时各用各的 worktree，不在同一个工作区里并行写入。

### 8.6 热点文件与状态推导

并行时最容易冲突的是路线图状态、待定问题的追加和顺序编号，按以下规则处理：

- 路线图不存状态。CI 在主干上推导：规格不存在为"待写"，`draft` 为"规格中"，`ready` 为"可实现"，所有 AC 都有通过的测试且（如涉及 AI）回归评测达标为"完成"。进行中的工作看 PR 列表。
- 功能级待定问题写在各自规格里，不抢同一个文件。
- 编号只在主干分配：`spec_tool new …` 在非主干分支上拒绝分配，分配后立即提交。
- 生成物冲突一律重新生成，不手工合并。

### 8.7 实施总纲与交接包

本仓库按 docs/meta/plan/README.md 推进（ADR-024）。drive 技能先运行 `status` 定位。每个闭环先在 `spec/loop-<闭环>` 分支上批量写规格：Codex 按 docs/meta/plan/packages.yaml 出规格编写包，网页版 Claude 写，Codex 机检并复核，再用大白话向产品负责人汇报，负责人确认后改为 ready。然后逐个功能实现：Codex 出计划编写包，网页版 Claude 写计划，Codex 复核、负责人确认；网页版 Claude 在同一个对话里实现，Codex 应用结果、运行 verify 并用 review-change 复查。最后按 close-loop 收尾并记校准。交接包由 `scripts/handoff.py` 按 packages.yaml 生成与应用，缺少必需依据时拒绝出包；交接仍只认 work 文件（8.4），验证以本地 verify 与 CI 为准（ADR-024、ADR-030）。

---

## 9 检查与闸门

### 9.1 三道闸门

| 闸门 | 触发 | 内容 | 性质 |
|---|---|---|---|
| Stop 闸门 | 两个工具每轮结束时调用 `scripts/agent_gate.py` | 只看本轮工作区改动：`check --changed`，加改动文件的 lint | 快速反馈。失败时返回 block 和错误清单，让 AI 接着修；同一轮最多拦一次，避免循环 |
| pre-commit | `git commit` | `verify --staged --fast` | 提交底线，与工具无关 |
| CI | PR 与主干 | `verify --full` | 合并底线。本地用 `--no-verify` 绕过提交检查也绕不过 CI |

hooks 只是加速。项目 hooks 需要每人在各自工具里审阅并信任，没有信任时只是少了快速反馈，底线仍由 pre-commit 和 CI 保证。

### 9.2 verify 的三档

- `--fast`（pre-commit）：改动文件的 lint、受影响包的类型检查和单元测试、`check --changed`、`gen --check`。
- 默认档（技能里的"完成标准"）：全部 lint、类型检查、单元测试、`check`、`gen --check`；涉及 `packages/ai/` 或 `evals/` 时加跑相关场景的回归评测。
- `--full`（CI）：默认档全部内容，加端到端冒烟（四个演示考试）、预算检查、覆盖报告。

具体命令在 `scripts/spec_tool.toml` 中按技术栈配置。

### 9.3 check 规则族

| 族 | 管什么 |
|---|---|
| E-INSTR | 禁止出现的指令文件；AGENTS.md 中的 `@` 导入和工具专属语法；章节与体量 |
| E-GEN | 生成物过期或被手改 |
| E-SKILL | skill 字段、正文写法、存放位置、描述长度 |
| E-HOOK | 两个工具的 hooks 配置指向同一组脚本，路径写法正确 |
| E-REF | refs 能解析；规格正文提到的契约名、参数名都已列入 refs |
| E-OWN | 归属唯一；非 learner 领域不直接写证据 |
| E-COV | 页面条目覆盖完整且不重复；条目编号只增不减 |
| E-REFINE / W-REFINE | 页面深化闸门；深化来源的外部编号不进仓库 |
| E-AC / E-INV | AC 和以测试执行的不变量都有对应测试 |
| E-AI | 场景有评测与阈值；有展示或导出的场景声明了标识；执行者直写权限符合 INV |
| E-DC | 字段都有数据类别；执行者可读类别存在 |
| E-PARAM | 参数已登记、有人引用；领域规则代码中没有裸阈值 |
| E-EXAM | 核心领域代码不按考试分支；演示考试数据符合结构 |
| E-WORK | 主干上 work 为空；分支上只有本功能的 work 文件，且章节齐全 |
| E-OQ | 编号唯一；`ready` 的规格不带没有临时默认的待定问题 |
| E-TERM | 禁用同义词和宣传禁用语 |
| E-ID | 编号唯一，只在主干分配，已分配的不删除 |
| E-CONV | 约定的 `applies_to` 与规则条数 |
| E-BUD / W-BUD | 预算 |
| W-SPEC | 规格体量与历史性措辞 |
| E-PHASE / W-PHASE | 功能与闭环的归属、切片条目、校准记录、熔断（5.18） |
| E-SCHEMA | 登记、路线图、规格与配置的结构和取值 |

每条规则的判定条件和改法见附录 K。报错格式统一为"编号 文件:位置：问题。改法：……"，例如：

```text
E-REF-01 docs/domains/practice/features/PRAC-02.md:refs.params：review.daily_capp 不存在。改法：可能是 review.daily_cap；如果是新参数，按重型通道先在 contracts/params.yaml 登记。
```

---

## 10 预算

预算一律按 UTF-8 字节或字符计量，并按工具分别统计：中文每字占 3 字节，按字符估算会严重低估 Codex 的字节上限占用。以下为初始值，依据度量调整，写在 `scripts/spec_tool.toml`。

| 项 | 计量口径 | 上限 |
|---|---|---|
| 根 AGENTS.md | 字节 | 8 KiB |
| 端级 AGENTS.md | 字节 | 3 KiB |
| 包级 AGENTS.md | 字节 | 2 KiB |
| Codex 指令链（根到最深可能的启动目录） | 字节 | 12 KiB（工具上限 32 KiB） |
| Claude 常驻（根 AGENTS.md + 不带 paths 的规则 + 非手动 skill 的描述） | 字节 | 10 KiB |
| skill 描述合计（按 Codex 口径，手动 skill 也计入） | 字符 | 3,000 |
| 单个 skill 描述 | 字符 | 300 |
| 同时生效的规则条数（典型全栈任务：根红线 + 适用约定规则 + 端级要点） | 条 | 60 告警，80 报错 |
| 单份约定的规则 | 条 | 15 |
| 功能规格正文 | 字符 | 6,000 |
| 任务包 | 字符（另报字节） | 15,000 |

`python scripts/spec_tool.py budget` 输出两份报告（`--tool claude` 和 `--tool codex`），并列出所有 `ready` 规格的任务包体量和同时生效规则数。超标的处理：常驻层超标就删减，优先删能推导的内容；规则数超标就把可检查的规则搬进 lint，或拆分约定；任务包超标就拆分功能。

---

## 11 验证与维护

### 11.1 冷启动测试（异构）

规格由哪个工具写，就由另一个工具做冷启动测试：用 review-spec 技能，只读任务包，列出所有"实现前必须问人或只能靠猜"的地方，每条标注缺信息、信息冲突、含糊或越界。本仓库的规格由网页版 Claude 写、Codex 复核，Codex 还要对照仓库依据核对（ADR-030）。没有阻断问题才能把规格改为 `ready`。重型通道两个工具都跑一次，问题取并集。可以用无头模式（`claude -p`、`codex exec`）在规格变更时自动运行，人只看问题清单。

### 11.2 复查（异构）

代码由哪个工具写，就由另一个工具用 review-change 技能复查：对照任务包逐条核对 R、AC、契约、不变量、参数、标识、数据类别、页面状态，输出带文件、行号和依据编号的问题清单。

### 11.3 读取轨迹

读取轨迹由 hooks 机械采集，写入 `.trace/`（已忽略提交），不靠 AI 自报。

- Claude：`InstructionsLoaded` 记录规则文件何时、因何加载（原生读入的 AGENTS.md 不触发这个事件，但它在会话开始时必然加载，无需记录）；`PostToolUse` 记录 Read 和 Bash 读取的文件。
- Codex：`PostToolUse` 记录 Bash 命令（从 `cat`、`sed -n`、`head`、`rg` 等命令中解析文件路径）和 `apply_patch`。需要审计 Codex 实际加载了哪些指令文件时，开启纯文本日志或查看会话 jsonl。

`python scripts/spec_tool.py trace-report` 汇总"任务包之外的读取"。包外读取频繁的功能，说明 refs 有缺口或功能太宽；work 文件"包外读取"一节只记原因。

### 11.4 有无对照

每季度、每次主力模型大版本升级后各做一次：选 8–20 个代表性任务（缺陷修复、页面任务、AI 场景调整、接入考试、跨领域功能），在"完整文档体系"和"只有代码与功能规格"两个仓库快照上，用两个工具的无头模式各跑三次，比较一次通过率、token 消耗和人工返工时间。两个工具分开统计，结果用于删掉没有增益的机制，也用于决定哪类任务交给哪个工具。

### 11.5 定期维护

- 每月：用 doc-garden 技能做一次"文档园丁"巡检，对照代码找过期的规格、约定和易错点，输出只改文档的 PR；在 Claude 中运行 `/doctor prompt-audit`，检查指令文件里过时、矛盾或引用不存在文件的内容。
- 每次模型大版本升级后：复查 AGENTS.md、约定和 skill，删掉为旧模型局限打的补丁，把强硬措辞改平实，然后做一次 11.4。
- 随时：任何人发现工具私有记忆里出现了项目知识，就把它提升进仓库，并清掉那条记忆。

---

## 12 失败归因

AI 出错时，先归因，再修在对应的位置。只修代码不归因，同类错误会再次出现。

| 现象 | 归因 | 修在哪里 |
|---|---|---|
| 任务包里没有某信息，AI 去猜了 | refs 漏写，或登记缺条目 | 补 refs 或登记；能由 E-REF-02 抓到的，确认检查已覆盖 |
| 任务包里的信息本身是错的 | 源错了 | 改源；再查为什么 check 没发现 |
| 信息在包里，AI 没有遵守 | 规则太多、措辞含糊或位置太靠后 | 精简、改成可判定的写法；能机检的改成 lint、check 或 hook |
| 大量读取任务包以外的文件 | 包有缺口，或功能太宽 | 补 refs，或拆分功能 |
| 两个工具表现不一致 | 某条规则只有一边看得见 | 移到两边都看得见的载体（P5） |
| 同一错误第二次出现 | 常驻层缺一条易错点 | 写进根或端级 AGENTS.md 的易错点（每条一行）；能机检的改成检查 |
| 工具私有记忆里出现项目知识 | 纠正没有落盘 | 提升进仓库，清掉记忆 |
| 范围遗漏 | 条目未覆盖或被错标为 `out_of_scope` | 修页面登记或路线图；查覆盖报告为何没有暴露 |
| 实现时发现页面交互细节缺失 | 该页漏列深化清单，或深化时漏转 | 用 refine-page 补转，同一次提交更新受影响的规格；查该页为何没有标 `pending` |
| 仓库中出现深化来源的编号或叫法 | 转写时没有翻译 | 翻译或删除；把漏掉的模式补进 `[deep_source].forbidden_patterns`（E-REFINE-03） |

---

## 13 写作约定

适用于 `docs/`、`contracts/` 中的散文、AGENTS.md 和 skill。其中可机检的部分由 check 执行。

W1. 只写现状。不写"原来""改为""之前"之类的历史描述，理由写进 ADR。

W2. 一事一址。引用其他事实时写 ID，不复述内容。

W3. 只写推不出来的。能从代码、契约或目录推导出的内容不写。

W4. 每条规则可判定。写不出判定方法的规则不是规则。"必须""禁止"类条款先问能否变成检查。

W5. 默认值写参数名，不写数字。

W6. 术语以 glossary 为准，不用禁用同义词。

W7. 规格里每个待定问题都有临时默认。

W8. 措辞平实。不用"务必""极其重要"、全大写、感叹号来强调。红线写一句做什么、一句为什么。新一代模型对强硬措辞反应过度，容易误触发。

W9. 共享文件（AGENTS.md、约定、规格、skill 正文）里不出现工具专属语法：`@` 导入、斜杠命令、`$技能名`、`$ARGUMENTS`、计划模式等。

W10. 命令、路径、ID 用英文；正文用中文。

W11. 清单类事实用 YAML 作源，不用 Markdown 表格作源。

W12. 示例用本产品的真实对象（页面 ID、参数名、场景 ID），不用通用占位。

W13. 不写目录地图。

W14. 删除优于打补丁：一条规则长期没有失败记录，或模型升级后不再需要，就删掉。

W15. 体量限制见第 10 章。

---

## 14 双工具适配

### 14.1 版本下限与环境检查

- Claude Code ≥ v2.1.283。v2.1.277 起，工作目录及以上没有 `CLAUDE.md`、`.claude/CLAUDE.md`、`CLAUDE.local.md` 时，Claude Code 会直接读 AGENTS.md；v2.1.281 之前，走 Bedrock 或关闭遥测的会话仍只读 CLAUDE.md；`/doctor prompt-audit` 需要 v2.1.283。从 v2.1.276 或更早版本升级后的第一个会话可能读不到 AGENTS.md，重启一次即可。
- Codex：hooks 可用、`/hooks` 能列出并信任项目 hooks 的版本（建议 ≥ v0.124）。

新机器或新成员先运行 `python scripts/spec_tool.py doctor`，它检查：Claude Code 版本；工作区内是否存在 `CLAUDE.local.md` 等禁止文件（这类文件通常被忽略提交，CI 看不到，只能本地查）；Codex 是否开启了 memories；`git config core.hooksPath` 是否指向 `.githooks`；Python 依赖。

验证两边确实读到同一套指令：在 Claude 中运行 `/memory`，列表里应能看到 AGENTS.md 的路径；在仓库根运行 `codex --ask-for-approval never "Summarize the current instructions."`，它应复述根 AGENTS.md 的要点。

### 14.2 指令文件

两个工具读同一批 AGENTS.md，仓库中不放任何 CLAUDE.md。只对 Claude 有用的少量说明（如果有）放 `.claude/rules/claude-code.md`，不带 `paths`，不超过 10 行；这个目录下的文件不影响 Claude 读取 AGENTS.md 的判断。计划先行、一会话一任务等流程规则对两个工具同样适用，写在 AGENTS.md。

Codex 的 `project_doc_max_bytes` 保持默认的 32 KiB，不调高；体量纪律由第 10 章保证。

### 14.3 skill 生成

`python scripts/spec_tool.py gen` 对每个源 skill 做三件事：

1. 复制到 `.claude/skills/<名>/`，按 `metadata.invocation: manual` 补上 `disable-model-invocation: true`，按 `metadata.args` 补上 `argument-hint`，并在 `metadata.generated_from` 写明来源。
2. 在源目录生成 `agents/openai.yaml`，手动 skill 写 `policy.allow_implicit_invocation: false`。
3. check 校验副本和 `openai.yaml` 与源一致。

用生成副本而不用软链：两个工具都支持软链的 skill 目录，但在 Windows 上建软链需要管理员权限或开发者模式，Git 默认还会把软链检出成普通文本文件；生成副本到处可用，还能顺便补上各工具自己的字段。

预算上要注意：Claude 中手动 skill 的描述不进上下文；Codex 中关闭隐式调用后描述仍在 skill 清单里，所以按常驻计入。

### 14.4 hooks

两个工具的 hooks 配置都只是薄转发，逻辑全部在 `scripts/` 下，配置见附录 I：

- Stop → `scripts/agent_gate.py`：用 git 判断本轮改动，跑 `check --changed` 和改动文件的 lint；失败时返回 `decision: block` 和错误清单，让 AI 接着修。同一轮已经被拦过一次（输入中 `stop_hook_active` 为真）就放行，只把剩余错误作为提示输出。它不解析编辑工具的负载，因此对 Claude 的 Edit/Write 和 Codex 的 apply_patch 一视同仁。
- SessionStart（startup、resume、clear、compact）→ `scripts/hooks/session_context.py`：从分支名取功能 ID，如果 `work/<ID>.md` 存在，输出一行提示让 AI 先读它。
- PostToolUse（以及 Claude 的 InstructionsLoaded）→ `scripts/hooks/trace.py`：记录读取轨迹。

脚本路径一律从仓库根解析：Claude 侧用 `$CLAUDE_PROJECT_DIR`，Codex 侧用 `$(git rev-parse --show-toplevel)`，Codex 在 Windows 上用 `commandWindows` 字段。Codex 的项目 hooks 只有在项目 `.codex/` 层被信任、且每个 hook 定义按哈希审阅信任后才运行；hooks 定义一改就要重新信任。Codex 官方也说明工具 hooks 只是护栏，不是完整的执法边界，所以正确性不依赖任何编辑前后的 hook。

### 14.5 记忆

- Claude：项目 `.claude/settings.json` 设 `autoMemoryEnabled: false`。
- Codex：本地 memories 默认关闭，本项目保持关闭；`doctor` 发现 `~/.codex/config.toml` 中开启了 `[features] memories` 时提示关闭，或至少对本项目关闭 `memories.use_memories` 和 `memories.generate_memories`。

两份私有记忆都存在本机、互不相通、不受版本控制，等于两份可能与唯一事实源矛盾的常驻层。所有纠正按第 12 章落到仓库。

### 14.6 计划与只读模式（可选）

计划阶段需要硬约束时：Claude 用 `claude --permission-mode plan` 启动；Codex 用只读沙箱启动。确认计划后再以正常模式开新会话实现。Claude 的计划文件可以通过 `plansDirectory` 指向 `work/.plans/`（已忽略提交）方便查看，但交接仍只认 `work/<ID>.md`。

### 14.7 导入功能

两个工具都有"从另一个工具导入配置"的功能。本仓库两边都不用：Claude 的导入会把 AGENTS.md 一次性追加进 CLAUDE.md，造成内容加载两遍且之后各自漂移；Codex 的导入会搬运 Claude 的设置、技能、hooks 和记忆。两个工具之间唯一的桥是 `spec_tool gen`。

另外，`.codex/rules/` 管的是命令审批，与 `.claude/rules/` 名字相近但用途不同，`gen` 不往里写任何东西。

### 14.8 Codex 单包沙箱模式（可选）

纯后端、只涉及一个领域包的任务，可以用 `codex --cd packages/domains/<领域> --add-dir contracts --add-dir tests --add-dir work` 启动，让"只写本领域"从文字规则变成沙箱约束。启动后确认根 AGENTS.md 和项目 hooks 都已加载。需要再加目录时，说明任务已经跨出单包，应当回到仓库根启动。

### 14.9 Windows

hooks 命令中的解释器名在各平台不一致。hooks、pre-commit 与 CI 中的命令写 `python3`；文档、技能与 AGENTS.md 中写 `python scripts/…`。Windows 电脑在 WSL2 中开发（ADR-025），两种写法都可用；不在 WSL2 中时，确保 `python3` 在 PATH 中可用（`doctor` 检查），Codex 侧另配 `commandWindows`。skill 用生成副本，不用软链。

---

## 附录 A　AGENTS.md 模板

### A.1 根 AGENTS.md

```markdown
# AGENTS.md

合并版 AI 通用备考：学员端、机构端、平台后台三端共用一组领域包，AI 能力贯穿各页。

## 权威来源（冲突时以此为准）
- 范围（有哪些页面，页面要有什么）：design/screens/
- 功能清单与首发范围：docs/product/roadmap.yaml
- 功能行为：docs/domains/<领域>/features/<ID>.md
- 接口、数据结构、权限、事件、错误码：contracts/
- 参数、阈值、开关：contracts/params.yaml
- AI 场景与 AI 执行者的读写范围：contracts/ai/
- 产品不变量与合规义务：docs/product/invariants.yaml
- 术语：docs/product/glossary.yaml
- 进行中任务的计划与交接：work/<ID>.md

## 红线
1. 核心领域代码不按考试写分支。考试差异只进考试画像数据或 docs/product/variation-points.md 登记的扩展点；否则每接一个考试都要改核心。
2. 阈值、配比、上限等数值只经参数访问器读取，不写字面量。这些值在后台可调，写死就会和后台不一致。
3. AI 执行者对学习计划、掌握档等学员状态只能产生待确认的提议，只有计划引擎能自动顺延。这是产品承诺（INV-01）。
4. AI 生成的内容在展示和导出时都带标识。这是法规义务（INV-05）。
5. 行为变化与规格、契约在同一次提交里更新，文档只写现状。规格与代码不同步，下一个任务就会照着错的规格做。
6. 标有 GENERATED 的文件不手改，改源后运行 gen。手改的内容会在下次生成时丢失。
7. 改了 packages/ai/ 下的文件，要跑对应场景的评测，结果不低于基线。

## 工作方式
- 新功能或改变已规定的行为：先把计划写进 work/<ID>.md，人确认后再改代码和契约。
- 一个会话只做一个任务（一个功能 ID 或一个缺陷）。
- 有功能 ID 的任务使用 implement-feature 技能。任务包里的规则就是本任务适用的全部规则，不必再读约定全文。
- 没有任务包的零散修改：先运行 `python scripts/spec_tool.py rules <要改的路径>`，按输出执行。
- 接手进行中的任务：先完整阅读 work/<ID>.md；离开前更新它。
- 规格没覆盖的情形：用规格中待定问题的临时默认；没有临时默认就停下来问。

## 命令
- 完成标准：`python scripts/spec_tool.py verify` 全部通过才算完成；不跳过提交检查。
- 文档检查：`python scripts/spec_tool.py check`
- 任务包：`python scripts/spec_tool.py pack <ID>`
- 适用规则：`python scripts/spec_tool.py rules <路径>…`
- 评测：`python scripts/spec_tool.py eval <场景>`
- 重新生成：`python scripts/spec_tool.py gen`

## 易错点
（只收录重复出现过的错误，每条一行。）

## Code Review Rules
- 新增或修改的数值阈值没有走参数登记。
- AI 输出中的数字不是来自算法字段。
- 写学员状态的代码路径绕过了"提议、确认"。
- 新增的导出路径没有生成内容标识。
- 机构端显示学员数据的组件没有经过可见性检查。
```

### A.2 端级 AGENTS.md

`apps/learner/AGENTS.md`：

```markdown
# 学员端（S01–S35）

## 本端要点
- 以手机为主，底部五个入口；平板与桌面是同一套页面的宽屏布局。
- 页面状态按 design/screens/learner/<页ID>.yaml 中的 states 实现，通用表现见 docs/conventions/ui-states.md。
- 未成年人模式由 account 领域给出开关，界面只读开关，不自行判断年龄。
- AI 内容一律使用带标识的 AI 内容组件。

## Code Review Rules
- 新页面或新视图缺少登记中列出的状态处理。
- 未成年人模式下出现了该模式不允许的入口。
- AI 内容没有使用带标识的组件。
```

`apps/org/AGENTS.md`：

```markdown
# 机构端（O01–O16）

## 本端要点
- 学员数据一律经可见性组件，按 contracts/data-classes.yaml 和学员授权过滤；组件之外不直接取学员数据。
- 含个人信息的导出走审批流程。
- 机构内容不进入公共库。

## Code Review Rules
- 绕过可见性组件读取学员数据。
- 手机号等字段未脱敏展示，或查看未留痕。
```

`apps/admin/AGENTS.md`：

```markdown
# 平台后台（P01–P19）

## 本端要点
- 敏感操作使用双人复核组件，并写审计日志。
- 参数修改必须填写理由；需灰度的参数只能走灰度流程，取值不得超出登记区间。
- 提示词发布只能选择仓库中存在且评测通过的版本。

## Code Review Rules
- 敏感操作缺少双人复核或审计日志。
- 参数编辑界面允许超出登记区间的取值。
```

---

## 附录 B　功能规格模板

```markdown
---
id: PRAC-02
status: draft            # draft | ready；done 由脚本推导
refs:
  api: [submitRetryAnswer]
  schema: [answer_records, retry_queue]
  permissions: [learner.practice.answer]
  events: [practice_retry_submitted]
  errors: [PRAC_SESSION_EXPIRED]
  domain_events: [evidence.recorded]
  params: [plan.review.daily_cap]
  data_classes: [learning_record]
  ai: [practice.explain]
  models: [srs#review-interval]
  inv: [INV-01, INV-05, INV-08]
  features: [PRAC-01, LRN-01]
  adr: []
open_questions:
  - id: OQ-PRAC-02-1
    q: 回炉题是否计入每日复习上限？
    default: 计入，上限取 plan.review.daily_cap
---

# PRAC-02 错题回炉

## 1 目标与边界
（一段话说明本功能做什么。）
不做：（明确列出容易被误以为属于本功能的内容。）

## 2 业务规则
R1. （每条可测；默认值写参数名。）
R2. ……

## 3 界面
（只写相对于页面登记和 ui-states 约定的例外。没有例外就写"无例外"。）

## 4 数据
（只写相对于契约的例外。）

## 5 AI 行为
（引用场景 ID，只写本功能特有的约束，例如本功能中讲解的触发条件。）

## 6 验收
PRAC-02-AC1
Given ……
When ……
Then ……

PRAC-02-AC2 ……

AI 部分：practice.explain 回归集中"回炉题讲解"子集达到 evals/practice.explain/thresholds.yaml 的阈值。

## 7 不变量与合规
INV-01、INV-05、INV-08
```

规格里的标题、领域、首发批次、依赖、覆盖条目都从 `roadmap.yaml` 取，不在规格中重复。

---

## 附录 C　页面登记模板

```yaml
# design/screens/learner/S06.yaml
id: S06
end: learner
title: 今日
mode: standard                  # guided | immersive | standalone | standard
purpose: >-
  （一两句话：这一页要让学员完成什么。）
refine: pending                 # 只在深化清单中的页出现：pending | refined（见 5.17）
views:                          # 视图名以原型为准，以下为示意
  - id: first-day
    when: 首次进入，尚无计划
  - id: normal
    when: 有计划的常规一天
states: [loading, empty, error, offline, restricted, insufficient_data]   # 只列适用的；normal 隐含
state_overrides:
  empty: （本页空态的特殊表现）
layout_notes:
  - （布局要点，例如手机与桌面的差异）
data:
  reads: [plan.today_items, plan.due_queue, learner.mastery, learner.target_level, plan.time_budget]
  writes: [evidence.completion, plan.actual_minutes]
ai:
  - scenario: plan.reason_text
    role: 为每条任务生成理由文案，数字只来自算法
entries: [S01, S05]
exits: [S10, S15, S18]
items:
  - id: S06-01
    text: （条目原文，去掉合并来源标记）
    page_priority: P0
  - id: S06-02
    text: ……
    page_priority: P1
    ui_only: true
  - id: S06-03
    text: ……
    page_priority: P2
    out_of_scope: （理由）
slice: design/screens/slices/S06.html
shots: design/screens/shots/S06/
```

覆盖关系不写在页面登记里，写在 `roadmap.yaml` 的 `covers` 中。一个条目只能处于"被覆盖""ui_only""out_of_scope"三者之一。

---

## 附录 D　新增契约模板

以下取值只为说明字段，均为示意；参数名、数值、数据类别名称以原型和 ADR 为准。

### D.1 contracts/domain-events.yaml

```yaml
- name: evidence.recorded
  owner: learner                    # 归属领域（唯一）
  emitted_via: learner.submitEvidence
  triggered_by: [practice, grading, content]
  payload:
    learner_id: uuid
    target_ref: string              # 知识点或题目
    strength: [strong, medium, weak, negative, pending]
    source: string
    occurred_at: datetime
  consumers: [plan, metrics]
  not_evidence:
    - 自习室专注时长
```

### D.2 contracts/params.yaml

```yaml
- name: plan.consolidate.min_ratio
  owner: plan
  default: 0.30
  range: [0.10, 0.60]
  unit: ratio
  tunable_by: [platform]            # platform | org | learner
  learner_range: null               # 学员可调时，必须落在 range 之内
  rollout: gray_required            # none | gray_required
  reason_required: true
- name: billing.quota.remind_at
  owner: billing
  default: [0.5, 0.2]
  unit: ratio_list
  tunable_by: [platform]
  rollout: none
  reason_required: true
- name: ai.instant_question_gen.enabled   # 功能开关同样登记在这里
  owner: aigov
  default: false
  unit: bool
  tunable_by: [platform]
  rollout: gray_required
  reason_required: true
```

### D.3 contracts/data-classes.yaml

```yaml
- id: learning_record                # 名称以原型 P18、S32、O04 定义的四类为准
  name: 学习记录
  examples: [answer_records, mastery_levels]
  visibility:
    learner: always
    org: by_consent                  # always | by_consent | never
    platform_ops: masked
  consent:
    scope: per_org
    revocable: true
    purge_copies_after_revoke_days: 30
  forbidden_purposes: [model_training, renewal_marketing]
  retention: （保留期限）
  export:
    allowed: true
    approval: required_if_personal_info
    labeling: required
  masking: {phone: partial}
```

### D.4 contracts/metrics.yaml

```yaml
- id: learner.forecast_gap
  name: 预测与差额
  definition: （一句话口径）
  formula_ref: docs/models/prediction.md#gap
  unit: 分
  shown_on: [S06, P02]
  owner: learner
```

### D.5 contracts/exam-profile.schema.json（结构要点）

```yaml
# 以 YAML 示意 JSON Schema 的主要结构
exam_id: string
name: string
structure:            # 科目、章节、考点的层级
  - subject: string
    sections: [...]
question_types:       # 题型清单及作答方式
  - type: single_choice | multi_choice | essay | ...
scoring:              # 计分规则、及格线、主观题评分细则引用
  pass_line: number
  rubrics: [ref]
duration_minutes: number
variation_extensions: [ref]   # 只能引用 variation-points.md 登记的扩展点
```

### D.6 contracts/ai/scenarios.yaml

```yaml
- id: plan.reason_text
  owner: plan
  actor: explainer
  purpose: 为今日任务生成理由文案
  screens: [S06]
  input_schema: packages/ai/plan.reason_text/input.schema.json
  output_schema: packages/ai/plan.reason_text/output.schema.json
  numbers_from: [plan.task.metrics]   # 输出中的数字只能来自这些算法字段
  model_tier: small                   # small | medium | large
  metering: {ai_points: 0}
  fallback: {mode: template, copy_key: plan.reason.fallback}
  confirmation: none                  # none | preview_confirm | human_review
  labeling: {explicit: true, implicit: true, on_export: true}
  reads: [learning_record]
  invariants: [INV-02, INV-04, INV-05]
  eval: evals/plan.reason_text/
  rollout: {flag: ai.reason_text.enabled, default: true}
```

### D.7 contracts/ai/actors.yaml

```yaml
- id: tutor
  name: AI 导师
  reads: [learning_record, tutor_dialog]
  writes:
    - {target: plan.items, mode: propose}
    - {target: tutor.messages, mode: direct}
  tools: [search_knowledge, create_proposal]
  scenarios: [tutor.chat, tutor.plan_suggest]
  escalation:
    crisis_signal: 停止催学，转平台值守
    answer_conflict: 拦截输出
- id: planner
  name: 计划引擎
  writes:
    - {target: plan.items, mode: direct}   # 只有计划引擎可以直写计划（INV-01）
- id: explainer
  name: 文案与讲解生成
  reads: [learning_record]
  writes: []                               # 只产出展示文本，不写学员状态
  scenarios: [plan.reason_text, practice.explain]
```

---

## 附录 E　不变量初始候选

以下条目从对原型的解析中提取，迁移时须逐条对照原型确认措辞与范围；合规条目的来源以法务确认为准。

| 编号 | 陈述 | 来源 | 执行方式 |
|---|---|---|---|
| INV-01 | AI 执行者对学习计划、掌握档等学员状态的写操作只能是待确认的提议；只有计划引擎可以自动顺延 | 产品决定（P11） | check（E-AI-03）、test |
| INV-02 | 任务理由等 AI 文案中的数字只能来自算法输出字段，模型只能润色措辞 | 产品决定（S06） | eval、test |
| INV-03 | AI 导师的写操作先预览、再由学员确认 | 产品决定 | test |
| INV-04 | 大模型或导师不可用时，今日清单与复习照常可用；计划与调度不依赖大模型 | 产品决定（P10 降级预案） | test |
| INV-05 | AI 生成内容在展示时带显式标识，下载、复制、导出的文件中也带显式标识，文件元数据带隐式标识 | 《人工智能生成合成内容标识办法》（2025-09-01 施行）及配套国家标准 | test、check（E-AI-02） |
| INV-06 | 14 岁以下不提供服务；14–17 岁进入未成年人模式 | 原型；未成年人保护相关规定 | test |
| INV-07 | 机构只能看到学员授权的数据类别；学员撤回授权后，相关副本在 30 日内删除 | 原型（S32、O04、P18） | test |
| INV-08 | 讲解与标准答案冲突时拦截输出 | 产品决定 | eval、test |
| INV-09 | 主观题批改把握低时转人工；一致性不达标的题型只给要点 | 产品决定（S20） | eval |
| INV-10 | 识别到危机信号时停止催学，并转平台值守；危机记录单独存储 | 产品决定 | test、review |
| INV-11 | 界面与宣传文案不出现"保过""必过"等禁用语 | 广告与宣传相关规定；原型 | check（E-TERM-02） |
| INV-12 | 机构内容不进入公共库、不用于训练；督学数据不用于续报营销 | 原型 | check（E-DC）、review |
| INV-13 | 手机号默认脱敏，查看留痕；含个人信息的导出须审批 | 原型；个人信息保护相关规定 | test |
| INV-14 | 后台敏感操作双人复核并留审计日志 | 原型 | test、review |
| INV-15 | 生成式 AI 功能上线前完成相应的备案或登记 | 原型（合规页） | process |
| INV-16 | 提示词灰度以学习效果指标判定，不以点击率判定 | 产品决定（AI 治理页） | review、eval |
| INV-17 | 任一关键评测指标低于阈值时阻断发布 | 产品决定（AI 治理页） | check（CI） |

---

## 附录 F　约定模板与页面状态约定

### F.1 约定模板

```markdown
---
applies_to: ["apps/**/*.tsx", "packages/ui/**"]
---
# <名称>约定

## 规则
1. （可判定的一句话。）（lint: <规则名>）
2. ……

## 示例
（用本产品的真实对象举例。）

## 理由
（给人看，不进任务包。）
```

### F.2 docs/conventions/ui-states.md

```markdown
---
applies_to: ["apps/**", "packages/ui/**"]
---
# 页面状态约定

## 规则
1. 每个页面和视图只实现其登记中 states 列出的状态。
2. 状态集合为七态：normal、loading、empty、error、offline、restricted、insufficient_data；登记中声明了 locked 的页面另实现锁定态。
3. 各状态使用 packages/ui 中对应的状态组件，不自绘。（lint: ui-state-component）
4. 页面登记中的 state_overrides 优先于本约定的通用表现。
5. 状态文案一律取文案键，不写死。（lint: no-raw-copy）
6. restricted 的具体原因（如权限、未成年人模式、额度用尽）与下一步入口按页面登记实现。
7. 每个状态至少有一个组件测试或截图测试。

## 示例
S06 的 empty 状态以 state_overrides 为准，而不是通用空态。

## 理由
原型统一定义了七态。通用表现集中写在这里，各页只写例外。
```

---

## 附录 G　work 文件模板

```markdown
---
id: PRAC-02
branch: feat/PRAC-02-retry
lane: 标准                # 标准 | 重型
started: 2026-10-14
---
# PRAC-02 进行中

## 计划（确认后才动代码）
- 改动文件：
- 参考文件：
- 契约变更：
- AC → 测试：
- 实现要点：
- 风险与不确定：
- 确认：（谁、何时）

## 决定
（会话中做的取舍，一行一条。收尾时，值得长期保留的提升到规格或 ADR。）

## 进度
- [ ] ……

## 交接记录
| 时间 | 工具 | 做了什么 | 下一步 |
|---|---|---|---|

## 包外读取
（读了任务包以外的文件时记一行：文件与原因。）

## 复核
（冷启动复核与异构复查的结论。）

## 未决
```

---

## 附录 H　skill 定义

### H.1 现行清单

| 名称 | 用途 | 调用 |
|---|---|---|
| implement-feature | 按功能 ID 实现或修改功能 | 只许手动 |
| write-spec | 组织闭环的规格编写：出编写包、回收结果并机检；编写由网页版 Claude 完成（ADR-030） | 只许手动 |
| review-spec | 复核规格：冷启动只看任务包，再对照仓库依据核对 | 只许手动 |
| review-plan | 复核网页版 Claude 写的功能计划，并写大白话计划概况 | 只许手动 |
| review-change | 对照任务包复查一个功能分支的改动 | 只许手动 |
| ai-scenario | 新增或修改 AI 场景：登记、提示词、评测与阈值 | 只许手动 |
| add-exam | 接入一个新考试：画像数据、校验、演示数据、端到端冒烟 | 只许手动 |
| doc-garden | 文档园丁：对照代码查找过期或矛盾的文档 | 只许手动 |
| triage-legacy | 迁移期专用：把旧模块文档中的规则细节分拣到规格、约定或 ADR | 只许手动；分拣暂缓期间保留（ADR-023），完成后删除 |
| refine-page | 页面深化：把深化来源原型中对应页的内容转写进合并版原型与功能规格草稿（见 5.17） | 只许手动 |
| open-loop | 闭环开卡：核对在制品与依赖，在 calibration.yaml 记开卡（5.18） | 只许手动 |
| close-loop | 闭环收尾：按完成定义核对，记实际轮次与校准系数（5.18） | 只许手动 |
| drive | 推进开发：运行 status 定位，按实施总纲执行下一步（8.7） | 只许手动 |

### H.2 implement-feature（源文件全文）

```markdown
---
name: implement-feature
description: 按功能 ID 实现或修改一个状态为 ready 的功能，遵循任务包与交接文件。Implement a feature by ID using its task pack and work file. 仅在用户明确调用时使用。
metadata:
  invocation: manual
  args: "<功能ID>"
---

# 实现功能

输入：调用消息中给出的功能 ID，例如 PRAC-02。没有给出就先问。

1. 交接。如果 work/<ID>.md 存在，完整阅读它，从"下一步"继续；不存在就运行 `python scripts/spec_tool.py work start <ID>` 创建。
2. 任务包。运行 `python scripts/spec_tool.py pack <ID>`，完整阅读它输出的包文件。包里的规则就是本任务适用的全部规则。只有包确实缺信息时才读包外文件，并在 work 文件"包外读取"一节记一行原因。
3. 计划。在 work 文件"计划"一节写出要改的文件、契约变更、AC 到测试的映射、风险，然后停下来请用户确认。用户确认之前不改代码和契约。
4. 实现。按计划修改。规格或契约需要变时，与代码在同一次提交里一起改，并在 work 文件"决定"一节记一行。遇到规格没覆盖的情形，用待定问题的临时默认；没有临时默认就停下来问。
5. 验证。运行 `python scripts/spec_tool.py verify`，直到全部通过。涉及 AI 场景时，确认相关场景的回归评测达到阈值且不低于基线。
6. 交接。更新 work 文件的进度、决定、交接记录（写明执行这一步的工具）和下一步。
7. 收尾。所有 AC 都有通过的测试后，运行 `python scripts/spec_tool.py work close <ID>`。它会检查值得长期保留的决定已经提升到规格或 ADR，然后删除 work 文件。
```

### H.3 其他 skill 的要点

write-spec：确认闭环已开卡、当前在 `spec/loop-<闭环>`；运行 `handoff.py write-specs <闭环>` 按 packages.yaml 出规格编写包（缺必需依据时拒绝出包）；回收用 `handoff.py in --latest L<闭环>-write`，它校验写入范围并运行 gen 与 check；只直接修正 check 已给出改法的机械问题，其余写成复核意见用 `write-specs <闭环> --notes` 退回网页版 Claude（ADR-030）。

review-spec：对每个功能运行 `pack <ID>`，只读包文件，列出实现前需要问人或只能靠猜的地方；再对照契约、ADR、术语、页面登记、算法规格与规格种子核对；检查闭环内功能之间与闭环级任务的衔接；每条标注缺信息、信息冲突、含糊、越界或违反依据；不提风格建议；没有问题时明确写"无阻断问题"；问题清零后写大白话概况。

review-plan：运行 `pack <ID>`，核对 work 文件计划的改动文件、参考文件、契约变更与 AC 覆盖；有问题用 `handoff.py write-plan <ID> --notes` 退回；通过后写大白话计划概况请用户确认。

review-change：运行 `pack <ID>` 和 `git diff main...HEAD`；逐条核对 R 与 AC 是否实现且有测试、契约变更是否与规格同提交、不变量、裸阈值、AI 标识、数据类别、页面状态；输出问题清单，分严重和一般两级，每条附文件、行号和依据编号；用户不要求就不改代码。

ai-scenario：读 `scenarios.yaml`、`actors.yaml` 的相关条目和相关 INV，没有场景就按附录 D.6 新增（重型通道）；先定义输出结构再写提示词，数字类字段只能来自 `numbers_from` 列出的算法字段；在 `evals/<场景>/` 准备用例（含人工金标，建议起步 30 条）、判分器（模型判分附人工校准记录）和 `thresholds.yaml`；运行 `eval <场景> --suite regression`，达到阈值且不低于基线，更新基线须人确认；降级路径有测试。

add-exam：先对照 `variation-points.md` 判断新考试能否只靠画像数据表达，需要新扩展点就停下，提出重型通道变更；在 `fixtures/exams/<考试ID>/` 写画像与样例题，通过 schema 校验；跑"今日清单 → 做题 → 错题回炉"端到端冒烟和相关评测的考试维度子集；确认核心领域代码中没有出现该考试 ID。

doc-garden：运行 `check --full` 和 `trace-report`；抽查已完成功能的 R、AC 与代码和测试是否一致；检查 AGENTS.md 易错点近期是否仍然发生、哪些可以删除；输出只改文档的 PR 或问题清单。

triage-legacy：输入一份旧模块文档的路径（位于归档位置）；范围以页面登记为准，不新增范围；把规则细节分拣到对应功能规格的 R、约定、ADR 或待定问题，无法归属的列给人决定。深化来源原型不归本技能处理，见 refine-page。

refine-page：输入目标页 ID。读 `spec_tool.toml` 中 `[deep_source]` 指向的深化来源原型，以及深化清单中该页的一行；对照该页现有登记，列出要新增的能力、视图、布局要点、状态例外和各条目的交互要点，以及与单一事实源冲突之处。冲突逐条交人裁决，裁决前不写入；采纳深化来源做法的，提醒用户按重型通道修改单一事实源。然后修改合并版原型（原型在改）或页面登记（原型冻结）：条目只在末尾追加、不手填序号，子面板与弹层做成视图，并把该页的 `refine` 改为 `refined`；原型在改模式下运行 `import-prototype --write-ids`，确认差异只落在该页。新条目分配到功能，需要新功能时请用户在主干运行 `new feature`。交互要点写进覆盖该条目的功能规格草稿（规格不存在就按附录 B 建为 `draft`），只写行为，数值写"由参数决定"，不写深化来源的编号与叫法。最后运行 `check` 直到通过，提示安排写规格。

open-loop、close-loop、drive：正文见各自的 SKILL.md（ADR-008、ADR-024）。

---

## 附录 I　工具配置

### I.1 .claude/settings.json

```json
{
  "autoMemoryEnabled": false,
  "plansDirectory": "./work/.plans",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          { "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR/scripts/hooks/session_context.py\" --tool claude" }
        ]
      }
    ],
    "InstructionsLoaded": [
      {
        "hooks": [
          { "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR/scripts/hooks/trace.py\" --tool claude --event instructions" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Read|Bash",
        "hooks": [
          { "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR/scripts/hooks/trace.py\" --tool claude" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "python3 \"$CLAUDE_PROJECT_DIR/scripts/agent_gate.py\" --tool claude", "timeout": 120 }
        ]
      }
    ]
  }
}
```

`plansDirectory` 是可选项，只为方便查看 Claude 的计划文件；交接只认 `work/<ID>.md`。

### I.2 .codex/hooks.json

```json
{
  "description": "exam-prep 项目 hooks，与 .claude/settings.json 指向同一组脚本",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$(git rev-parse --show-toplevel)/scripts/hooks/session_context.py\" --tool codex",
            "commandWindows": "py -3 scripts\\hooks\\session_context.py --tool codex"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash|apply_patch",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$(git rev-parse --show-toplevel)/scripts/hooks/trace.py\" --tool codex",
            "commandWindows": "py -3 scripts\\hooks\\trace.py --tool codex",
            "async": true
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$(git rev-parse --show-toplevel)/scripts/agent_gate.py\" --tool codex",
            "commandWindows": "py -3 scripts\\agent_gate.py --tool codex",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

`commandWindows` 中的相对路径依赖"从仓库根启动"。首次使用和每次修改 hooks 定义后，在 Codex 中打开 `/hooks` 审阅并信任。

### I.3 agent_gate.py 的行为约定

1. 从标准输入读取 JSON，取 `stop_hook_active`。
2. 用 `git status --porcelain` 取本轮改动；没有改动就输出 `{}` 并退出。
3. 运行 `spec_tool check --changed` 和改动文件的 lint。
4. 全部通过就输出 `{}`。
5. 有失败且 `stop_hook_active` 为假时，输出 `{"decision": "block", "reason": "<错误清单与改法>"}`，让 AI 接着修。
6. 有失败但 `stop_hook_active` 为真（本轮已拦过一次）时，输出 `{"systemMessage": "<剩余错误>"}` 后放行，交给 pre-commit 和 CI 兜底。
7. 退出码始终为 0，输出始终是合法 JSON；总耗时控制在 30 秒以内，慢的检查留给 pre-commit 和 CI。

### I.4 生成的 agents/openai.yaml

```yaml
# GENERATED by spec_tool gen，来源：SKILL.md 的 metadata.invocation；勿手改
policy:
  allow_implicit_invocation: false
```

### I.5 .gitignore 相关行

```gitignore
CLAUDE.local.md
AGENTS.override.md
AGENTS.local.md
.pack/
.trace/
work/.plans/
```

### I.6 .githooks/pre-commit

```sh
#!/bin/sh
exec python3 scripts/spec_tool.py verify --staged --fast
```

安装：`git config core.hooksPath .githooks`（`doctor` 检查）。已经在用 lefthook 或 husky 的，调用同一条命令即可。

### I.7 CI 步骤

1. `python3 scripts/spec_tool.py verify --full`
2. 改动涉及的 AI 场景跑回归评测：`python3 scripts/spec_tool.py eval --affected --suite regression`
3. 主干上生成 `roadmap.md` 与覆盖报告，作为构建产物发布。

### I.8 scripts/spec_tool.toml（示例）

```toml
[paths]
prototype_source = "../exam-prep-archive/prototype/prototype-v1.0.html"   # 原型冻结（ADR-001）：截图仍从它生成

[deep_source]              # 页面深化来源（见 5.17），只由 refine-page 读取
prototype = "../exam-prep-archive/deep-source/prototype.html"
refine_list = "../exam-prep-archive/deep-source/refine-list.md"
# E-REFINE-03 扫描的外部编号模式，按深化来源的实际编号配置；以下为示意
forbidden_patterns = ['(?<![A-Za-z0-9-])B-\d+[a-z]?(?![0-9])', '(?<![A-Za-z0-9])T\d{2}(?![0-9])', '(?<![A-Za-z0-9])D-\d{3}(?![0-9])', 'T-AI-\d+', 'ISS-\d+', '§\d']

[budgets]
root_agents_kib = 8
end_agents_kib = 3
pkg_agents_kib = 2
codex_chain_kib = 12
claude_resident_kib = 10
skill_desc_total_chars = 3000
skill_desc_max_chars = 300
rules_concurrent_warn = 60
rules_concurrent_error = 80
convention_rules_max = 15
spec_body_chars = 6000
pack_chars = 15000

[shots]                    # 各端截图宽度
learner = [375, 834, 1280]   # 834：平板竖屏（ADR-029）
org = [1280]
admin = [1280]

[verify]                   # 按技术栈替换
lint = "pnpm lint"
typecheck = "pnpm typecheck"
test = "pnpm test"
e2e_smoke = "pnpm e2e:smoke"

[tools]
claude_min_version = "2.1.283"
```

---

## 附录 J　spec_tool 命令参考

| 命令 | 作用 | 谁用、何时用 |
|---|---|---|
| `pack <ID> [--spec-mode] [--allow-over]` | 生成任务包到 `.pack/<ID>.md` | skill 第一步 |
| `rules <路径>…` | 输出这些路径适用的约定规则和各级 AGENTS.md | 零散任务 |
| `check [--changed] [--full]` | 运行附录 K 的全部检查 | Stop 闸门、pre-commit、CI、手动 |
| `verify [--staged] [--fast\|--full]` | 完成标准：lint、类型、测试、check、gen --check、相关评测 | 任务收尾、pre-commit、CI |
| `gen [--check]` | 重新生成全部派生物；`--check` 只校验是否过期 | 改了约定、skill、参数、路线图之后 |
| `budget [--tool claude\|codex]` | 预算报告 | 每次改动常驻层之后、CI |
| `eval <场景>\|--affected [--suite regression\|quality]` | 运行评测，对比阈值和基线 | AI 场景改动 |
| `new feature\|adr\|oq\|inv\|scenario …` | 分配编号并按模板创建（只在主干运行） | 登记新事实 |
| `work start <ID>` / `work close <ID>` | 创建或收尾 work 文件 | 标准与重型通道 |
| `import-prototype --from <路径> [--write-ids]` | 从原型抽取页面登记、切片和待定问题候选，把合并来历导出到归档；`--write-ids` 把条目编号写回原型，并为新条目分配序号 | 迁移（首次即带 `--write-ids`）；"原型在改"模式下的同步 |
| `shots [--page <页ID>]` | 无头浏览器截图 | 页面登记变化后 |
| `coverage` | 页面条目覆盖报告，含"页内 P0 但不在 R1"清单，以及待深化页和覆盖它们的功能 | 规划、CI |
| `trace-report [--session <ID>]` | 读取轨迹汇总 | 失败归因、月度巡检 |
| `show <登记> [<ID>]` | 以可读形式显示任一 YAML 登记 | 人查阅 |
| `status [--loop <闭环>]` | 当前期、受众环、闭环、下一切片与校准系数；闭环卡（5.18） | 每个会话开头（drive 技能） |
| `doctor` | 本地环境检查 | 新机器、新成员、升级后 |

交接包的命令是 `python scripts/handoff.py`，子命令 out、specs、in、selftest（8.7）。

---

## 附录 K　检查规则全表

"E-" 为错误，阻断提交；"W-" 为告警，不阻断。

| 编号 | 条件 | 改法 |
|---|---|---|
| E-INSTR-01 | 仓库中出现 `CLAUDE.md`、`.claude/CLAUDE.md`、`CLAUDE.local.md`、`AGENTS.override.md`、`AGENTS.local.md` | 删除；个人偏好放 `~/.claude/CLAUDE.md` 或 `~/.codex/AGENTS.md` |
| E-INSTR-02 | 任一 AGENTS.md 在代码段之外出现 `@路径` | 改成"见 <路径>" |
| E-INSTR-03 | AGENTS.md、约定或 skill 正文出现工具专属语法 | 改成要达到的结果 |
| E-INSTR-04 | 根 AGENTS.md 缺少规定的章节，或顺序不对 | 按附录 A.1 调整 |
| E-GEN-01 | 生成物过期 | 运行 `gen` |
| E-GEN-02 | 生成物与源不符且源未改动（被手改） | 把改动移到源，再运行 `gen` |
| E-SKILL-01 | 源 SKILL.md 使用了开放标准以外的 frontmatter 字段 | 移入 `metadata` 或删除 |
| E-SKILL-02 | skill 正文出现 `$ARGUMENTS`、`$0` 或工具专属命令 | 改写为工具中立的描述 |
| E-SKILL-03 | 仓库根以外出现 `.agents/skills` 或 `.claude/skills` | 移到根目录 |
| E-SKILL-04 | 描述超长或缺触发词 | 精简，把用途和触发词放在开头 |
| E-HOOK-01 | 两个工具的 hooks 指向的脚本集合不一致 | 对齐附录 I |
| E-HOOK-02 | hooks 命令使用了未从仓库根解析的路径 | Claude 用 `$CLAUDE_PROJECT_DIR`，Codex 用 git 根 |
| E-REF-01 | refs 指向不存在的条目 | 修正拼写，或按重型通道先登记 |
| E-REF-02 | 规格正文提到的契约名、参数名、场景 ID 没有列入 refs | 补进 refs，否则任务包里缺切片 |
| E-OWN-01 | 表、业务事件、参数、AI 场景没有 `owner`，或 `owner` 不是 `domain-map.yaml` 中的领域名 | 补上或修正 `owner` |
| E-OWN-02 | learner 以外的领域直接写证据或掌握档表 | 改为调用 learner 的接口 |
| E-COV-01 | 页面条目既未被覆盖，也未标 `ui_only` 或 `out_of_scope` | 分配到功能，或标注 |
| E-COV-02 | 一个条目被多个功能覆盖 | 只保留一个 |
| E-COV-03 | `covers` 指向不存在的条目 | 修正 |
| W-COV-04 | 页内 P0 条目由不在 R1 的功能覆盖 | 人工确认首发范围 |
| E-COV-05 | 与主干上一版相比（编号基线相同时，见 `design/screens/ID_BASELINE`），页面登记中有已分配的条目编号消失 | 恢复该条目并标 `removed: true`；条目编号只增不减 |
| E-REFINE-01 | `ready` 的规格所覆盖条目所在页的 `refine` 为 `pending` | 先用 refine-page 完成该页深化，再改为 `ready`；该页若无需深化，从深化清单移除并去掉 `refine` 字段 |
| W-REFINE-02 | 重新导入后，`ready` 或已完成功能所覆盖的条目文本有变化 | 按标准通道在同一次提交里更新受影响的规格，或撤回该原型改动 |
| E-REFINE-03 | 仓库文件出现 `[deep_source].forbidden_patterns` 匹配的内容 | 翻译为本仓库的 ID（表名、ADR、参数名）或删除 |
| E-AC-01 | `ready` 且本次改动涉及的功能，有 AC 没有对应测试（测试标题含 `[<ID>-AC<n>]`） | 补测试 |
| E-AC-02 | 测试引用了不存在的 AC 或 INV 编号 | 修正 |
| E-INV-01 | 执行方式含 `test` 的不变量没有测试 | 补测试 |
| E-AI-01 | 场景缺少评测目录或阈值文件 | 按 5.7 补齐 |
| E-AI-02 | 有展示或导出输出的场景没有声明标识 | 补 `labeling` |
| E-AI-03 | 除计划引擎外，有执行者对计划或掌握档类目标拥有 `direct` 写权限 | 改为 `propose`（INV-01） |
| E-AI-04 | `packages/ai/<场景>/` 有改动，但没有该场景本次的回归评测记录 | 运行 `eval <场景>` |
| E-AI-05 | 场景引用的执行者、数据类别或参数不存在 | 修正或登记 |
| E-DC-01 | schema 字段没有标注数据类别 | 补标注 |
| E-DC-02 | 执行者的可读类别不存在，或数据类别缺少机构可见默认值 | 补登记 |
| E-PARAM-01 | 代码引用了未登记的参数名 | 先登记 |
| W-PARAM-02 | 登记的参数没有任何引用 | 确认后删除 |
| E-PARAM-03 | 领域规则代码中出现未豁免的数值字面量（0、1、-1 除外） | 改为参数访问器 |
| E-EXAM-01 | 核心领域代码中出现考试 ID 或考试名（exam 领域与 fixtures 除外） | 改为画像数据或登记过的扩展点 |
| E-EXAM-02 | 演示考试数据不符合 `exam-profile.schema.json` | 修正数据 |
| E-WORK-01 | 主干上 `work/` 非空 | 收尾时运行 `work close` |
| E-WORK-02 | 分支上存在与分支功能 ID 不符的 work 文件 | 移走或删除 |
| E-WORK-03 | work 文件缺少必需章节 | 按附录 G 补齐 |
| E-OQ-01 | `ready` 的规格带有没有临时默认的待定问题 | 补临时默认 |
| E-OQ-02 | 待定问题编号重复 | 修正 |
| E-TERM-01 | 文档或界面文案使用了禁用同义词 | 换成 glossary 中的术语 |
| E-TERM-02 | 界面或宣传文案出现禁用语 | 删除（INV-11） |
| E-ID-01 | 功能、ADR、OQ、INV 编号重复，或在非主干分配 | 在主干重新分配 |
| E-ID-02 | 与主干上一版相比，`roadmap.yaml` 中有已分配的功能编号消失 | 恢复该条目；不做的功能写 `withdrawn` 并清空 `covers` |
| E-CONV-01 | 约定缺少 `applies_to`，或"## 规则"超过 15 条 | 补齐或拆分 |
| E-BUD-01 | 任一 AGENTS.md 超出字节预算 | 删减，优先删能推导的内容 |
| E-BUD-02 | 同时生效规则数超过报错线 | 把可检查的规则移入 lint，或拆分约定 |
| W-BUD-03 | 同时生效规则数超过告警线，或 skill 描述合计超限 | 精简 |
| W-SPEC-01 | 规格正文超长，或出现"原来""改为""之前"等历史性措辞 | 拆分或改写为现状 |
| E-PHASE-01 | 功能不属于任何闭环，或属于多个闭环 | 在 phases.yaml 中只放进一个闭环 |
| E-PHASE-02 | 闭环引用了不存在的功能 | 修正编号，或先在主干 `new feature` |
| E-PHASE-03 | 同一期的功能 release 不一致 | 按 5.18 的对应统一 release |
| W-PHASE-04 | 闭环缺少一句话演示或预算 | 补 demo 与 budget_rounds |
| E-PHASE-05 | 切片编号重复或不以闭环编号开头；切片条目不在登记中或不由本闭环的功能覆盖；没有条目的切片缺少可解析的 carrier；切片类型不合法 | 修正切片 |
| E-PHASE-06 | 校准记录指向不存在的闭环、字段格式不合法，或事件类型不合法 | 按 calibration.yaml 文件头的说明改写 |
| W-PHASE-07 | 实际轮次超过熔断线却没有熔断记录 | 写 fused（移回待办的切片） |
| E-SCHEMA-01 | 登记、路线图、规格与配置的结构或取值不合法，例如功能编号前缀与领域不符、规格不在路线图中 | 按报错修正 |

---

## 附录 L　领域划分

共 18 个，分为四组；划分以 ADR-002 与 docs/product/domain-map.yaml 为准。领域代码是功能 ID 的前缀，领域名用于目录、场景 ID 和 `owner` 字段。

| 组 | 领域代码 | 领域名 | 职责 |
|---|---|---|---|
| 学习核心 | LRN | learner | 学习证据、六档掌握、学习者模型（证据的唯一写入方） |
| 学习核心 | PLAN | plan | 计划引擎、排程、到期队列、时间预算 |
| 学习核心 | MAP | map | 知识地图与考纲结构 |
| 学习核心 | PRAC | practice | 练习、作答、错题与回炉 |
| 学习核心 | GRADE | grading | 批改，含主观题 |
| 学习核心 | TUTOR | tutor | AI 导师与问答 |
| 内容 | EXM | exam | 考试画像库 |
| 内容 | CONT | content | 内容与题库 |
| 内容 | MOD | moderation | 内容审核流水线 |
| 机构 | ORG | org | 机构教务、班级、督学 |
| 平台 | ACCT | account | 账号、身份、年龄分段与未成年人模式 |
| 平台 | BILL | billing | 套餐、额度、AI 点数 |
| 平台 | AIGOV | aigov | AI 场景注册、模型路由、提示词灰度、发布前评测 |
| 平台 | COMP | compliance | 合规、数据授权、导出审批、标识检查 |
| 平台 | METR | metrics | 指标口径与分析 |
| 平台 | ENG | engagement | 触达与增长：通知、提醒与公告 |
| 平台 | SUPP | support | 客服、工单与反馈 |
| 平台 | PLAT | platform | 端外壳、参数中心与平台基础 |

---

## 附录 M　迁移计划（迁移完成后删除本附录）

迁移状态：第 0–3 步已完成；第 4 步暂缓（ADR-023）；第 5 步的行走骨架由分期的 0.3 与 1 期承担（5.18），骨架页的深化随页面深化一并暂缓。第 4 步完成后删除本附录。

按依赖和风险排序。每一步完成后运行 `check` 与 `budget`。

**第 0 步：接线（约半天）。** 统一版本下限；重写根 AGENTS.md（把计划先行、一会话一任务写进去）；删除全部 CLAUDE.md 垫片；建立 `.agents/skills` 单一来源和 `gen`；关闭两边的私有记忆；配置两边的 hooks、`.githooks` 和 CI 骨架；运行 `doctor`，并按 14.1 验证两个工具读到的是同一套指令。这一步先做，是为了让后续迁移工作本身就由两个工具在一致的规则下完成。

**第 1 步：原型抽取与覆盖（最高优先级）。** 先在归档建立深化清单（见 5.17），对清单中的页做宽度补齐并标 `refine: pending`。然后写 `import-prototype`，首次导入即带 `--write-ids`，生成 70 份页面登记、切片和截图；合并来历导出到归档位置，值得保留的合并决定提炼成 ADR；31 条"问题"转为待定问题；以原型的全部条目为范围底账，生成 `roadmap.yaml` 候选，确定每个功能的 `release` 和 `covers`；`coverage` 清零 E-COV。范围漏项是代价最高的错误，越晚做，路线图和原型之间对不上的地方越多。

**第 2 步：七份 ADR 与跨页口径裁决。** 七份 ADR：原型为范围权威（以及原型在改还是冻结、深化来源原型的地位）；领域划分（含 learner 核心域）；三端 monorepo 结构；提示词治理（仓库为准）；证据模型（哪些行为算证据、强度等级、权重来源）；数据类别与可见规则；双工具适配策略。前三份决定目录和登记的结构，提示词、证据、数据类别三份决定新契约的字段，双工具适配一份记录第 14 章的取舍。同时裁决合并版原型与深化来源原型定义不一致的跨页口径，每项只留一个版本，写入 `glossary.yaml`、`docs/models/learner-model.md`、`contracts/exam-profile.schema.json` 或相关 ADR：掌握档的档位与写入方式（自评怎样生效）；错因的层级与类目；重要度刻度；笔记类型；知识点身份（有名称的地图节点，还是教材知识块）；额度与降级规则（核心闭环是否设限，降级后超额内容怎样处理）；AI 对话面板作为共享组件的归属与契约；题型清单。这些口径须在第 5 步骨架开工前定下。

**第 3 步：框架与工具。** 建立七份新契约的文件和字段结构（条目随功能追加）；把第二册各约定的规则迁入 `docs/conventions/`，页面状态改为引用 `ui-states`；扩展 `pack`（规则摘录、端级说明、页面切片、新 refs 类型、`--spec-mode` 的深化闸门）、`rules`、`check`（附录 K，含 E-COV-05、E-ID-02 与 E-REFINE 族）、`coverage`（待深化页清单）、`budget`（分工具、按字节）；在 `spec_tool.toml` 配置 `[deep_source]`；建立 refine-page 技能。

**第 4 步：旧文档分拣。** 用 triage-legacy 技能把 126 份旧模块文档中的规则细节分拣进对应规格、约定或 ADR；分拣完成后删除该技能。

**第 5 步：行走骨架。** 选"今日清单 → 做题 → 错题回炉"一条核心旅程，按标准通道实现，全程使用异构冷启动和复查；随后做第一次有无对照（11.4），根据数据删掉没有增益的机制。骨架经过的页在深化清单中的（做题与解析 S18、错题本 S19 都有深化来源），先用 refine-page 完成深化；没有深化就进入 `ready` 的规格会被 E-REFINE-01 拦下。

