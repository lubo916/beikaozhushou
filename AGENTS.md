# AGENTS.md

备考助手（AI 通用备考）：学员端、机构端、平台后台三端共用一组领域包，AI 能力贯穿各页，计划与调度不依赖大模型。

## 权威来源（冲突时以此为准）
- 范围（有哪些页面，页面要有什么）：design/screens/
- 功能清单、首发批次、覆盖条目与依赖：docs/product/roadmap.yaml
- 分期、闭环、切片与黄金路径：docs/product/phases.yaml；实测轮次与校准：docs/product/calibration.yaml
- 功能行为：docs/domains/<领域>/features/<ID>.md
- 接口、表结构、权限、埋点、错误码、业务事件：contracts/
- 参数、阈值、开关：contracts/params.yaml
- AI 场景与 AI 执行者的读写范围：contracts/ai/
- 算法：docs/models/；不变量与合规义务：docs/product/invariants.yaml
- 术语：docs/product/glossary.yaml；设计决定：docs/adr/（技术栈与版本基线见 ADR-025）
- 进行中任务的计划与交接：work/<ID>.md

## 红线
1. 核心领域代码不按考试写分支。考试差异只进考试画像数据或 docs/product/variation-points.md 登记的扩展点；否则每接一个考试都要改核心。
2. 阈值、配比、上限等数值只经参数访问器读取，不写字面量。这些值在后台可调，写死就会和后台不一致。
3. AI 执行者对学习计划、掌握档等学员状态只能产生待确认的提议，只有计划引擎能自动顺延。这是产品承诺（INV-01）。
4. AI 生成的内容在展示和导出时都带标识。这是法规义务（INV-05）。
5. 行为变化与规格、契约在同一次提交里更新，文档只写现状。规格与代码不同步，下一个任务就会照着错的规格做。
6. 标有 GENERATED 的文件不手改，改源后运行 gen。手改的内容会在下次生成时丢失。
7. 改了 packages/ai/ 下的文件，要跑对应场景的评测，结果不低于基线。
8. 依赖与大版本只用 ADR-025 登记的，不自行安装或升级。训练语料里旧写法多，未登记的库和版本会带进不兼容的写法。

## 工作方式
- 开工先运行 `python scripts/spec_tool.py status`：它给出当前期、当前闭环、下一个切片与待深化的页。
- 新功能或改变已规定的行为：先把计划写进 work/<ID>.md，人确认后再改代码和契约。
- 一个会话只做一个任务（一个切片、功能 ID 或缺陷）；同一时间只开一个闭环；会话之间状态只靠 work 文件和 git 传递。
- 有功能 ID 的任务使用 implement-feature 技能。任务包里的规则就是本任务适用的全部规则，不必再读约定全文。
- 没有任务包的零散修改：先运行 `python scripts/spec_tool.py rules <要改的路径>`，按输出执行。
- 接手进行中的任务：先完整阅读 work/<ID>.md；离开前更新它。
- 规格没覆盖的情形：用规格中待定问题的临时默认；没有临时默认就停下来问。
- 覆盖条目所在页标着 refine: pending 时，先完成页面深化再写规格。

## 命令
- 完成标准：`python scripts/spec_tool.py verify` 全部通过才算完成；不跳过提交检查。
- 当前位置：`python scripts/spec_tool.py status`；某个闭环的闭环卡：`python scripts/spec_tool.py status --loop <闭环>`
- 文档检查：`python scripts/spec_tool.py check`
- 任务包：`python scripts/spec_tool.py pack <ID>`；写规格阶段加 `--spec-mode`
- 适用规则：`python scripts/spec_tool.py rules <路径>…`
- 评测：`python scripts/spec_tool.py eval <场景>`
- 重新生成：`python scripts/spec_tool.py gen`

## 易错点
（只收录重复出现过的错误，每条一行。）

## Code Review Rules
- 新增或修改的数值阈值没有走参数登记。
- AI 输出中的数字不是来自算法字段。
- 写学员状态的代码路径绕过了“提议、确认”。
- learner 以外的代码直接写证据或掌握档。
- 新增的导出路径没有生成内容标识。
- 机构端显示学员数据的组件没有经过可见性检查。
- 核心闭环的代码路径依赖了大模型或额度判断。
