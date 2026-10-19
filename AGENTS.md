# AGENTS.md：备考助手 V4 常驻规则（Codex 与 Claude 共用）

> Codex 每次会话自动读本文件；网页版 Claude 由压缩包里的 START_HERE.md 指过来读。本文件保持 150 行以内，新增规则先问：能不能做成检查？

## 项目一句话

AI 通用备考产品。学员端 35 页为主，另有机构端 16 页、平台后台 19 页。需求以原型为准：`python3 tools/bk.py spec <页ID>` 看页面说明，`python3 tools/bk.py proto <页ID> --views` 看截图。技术栈见 docs/baseline/tech.md：TypeScript monorepo，React 19 + Vite、Fastify、Prisma + PostgreSQL、pnpm。

## 开工三件事

1. 运行 `python3 tools/bk.py start <任务编号>`，它会打印任务简报。一切以任务简报为准。
2. 只读简报「必读」里的文件；「按需查」先用 `grep -rn`（或 `rg`）搜索再看局部；「不要读」不看。不要通读仓库。
3. 动手前在对话里用 5 行以内说清做法，然后直接做，不等确认。

## 冲突时听谁的

红线 ＞ 用户拍板过的决定（docs/decisions/）＞ docs/baseline/（词汇、参数、规则卡、勘误表）＞ 原型 ＞ 其他。原型里已知的前后矛盾记在 docs/baseline/errata.md，以“采用”一列为准；新发现的矛盾按这个顺序取舍，并写进交接单。

## 红线（违反任何一条都不算完成）

1. 核心领域代码不按考试写分支：考试之间的差异只放数据与配置。
2. 阈值、比例、上限、天数这类数字只经参数访问器读取：规则代码里不写裸数字，文案里出现的规则数字也用参数插值（如“间隔 {{days}} 天做对 {{times}} 次”）。
3. AI 对学员状态（计划、掌握档、卡片、范围）只能提出“待确认的提议”；只有计划引擎能自动顺延，并且可撤销。
4. AI 生成的内容在页面上带显式标识；复制、下载、导出的文件里也带。
5. 页面只显示接口返回的业务数字，不在页面里重算掌握档、预测、完成度这类数字。
6. 作答、证据、复习记录、重排记录、点数流水、审计记录只追加、不修改；时间存 UTC，“今天”按用户时区算。
7. 密钥、真实账号、真实用户数据不进仓库、不进压缩包：用 .env（不提交）和 .env.example。
8. 依赖与大版本只用 docs/baseline/tech.md 登记的；要新增依赖，写进交接单，由整合任务处理。
9. 进度文件（progress/tasks.json、pages.json、questions.json、board.*、changelog.md、questions.md）只由本地 bk 维护，AI 不手改。
10. 界面与文案不出现“保过”“必过”“押题”等用语；面向用户的文字全部用中文。

## 改动范围

- 只改任务简报「你只能改这些位置」，`bk done` 会检查。公共组件、路由表、依赖、令牌、地基文档、tools/ 这些热点文件不在你的范围内时不能改。
- 需要改范围外的东西：写进交接单「风险与提醒」，说清要改什么、为什么，由整合任务统一处理。
- 页面任务只在本页目录、本页接口文件、本页假数据、本页文案文件、本页测试里干活。

## 怎么写

- 先找样板：页面照 apps/learner/src/pages/S10/ 写，组件先在 packages/ui 里找，领域代码照已有领域写。
- 文案进 i18n 文件；术语只用 docs/baseline/vocabulary.md 里的叫法。
- 接口先改 contracts/openapi/，再运行 `pnpm gen` 生成钩子；不手写请求，不手改生成物。
- 每个页面都要能显示七态：加载、空、出错、离线、受限、数据不足，加上正常（`?state=` 可强制）。
- 原型里的功能点在代码旁注释编号，如 `// feat:S06-03`。P2 功能点先不做。
- 小步提交：每完成一个能运行的小步就 `git commit`，提交信息用中文一句话。
- 业务规则写成纯函数，放 `packages/domains/<领域>/core/`（不碰数据库与服务端依赖）：浏览器的模拟层和服务器共用这一份。页面组件不直接引用它，只经接口钩子拿结果。
- 数据结构冻结前（见 tools/bk.config.json 的 schema_frozen）不写迁移文件：改 schema 后用 `prisma db push` 和种子重建。

## 测试与修 bug

- 修 bug：先写一个能复现的测试，确认它失败，再修，修好后它通过。这个测试永久保留。
- 随时可跑 `python3 tools/bk.py verify --level quick`；收工前网页端跑 `--level web`，本地跑 `--level full`。
- 规则类逻辑用规则卡的例子表做测试（tests/rules/）。
- 不许为了让测试通过而删测试、改断言或加跳过（skip、only、todo）。`bk done` 会自动拦下；确实是测试错了，改对它，并用 `--allow-test-change "理由"` 写明。
- 规则卡定稿后，它的例子表测试（tests/rules/）和黄金路径测试（tests/e2e/golden/）锁定，只有规则卡任务能改。

## 交接单与决定卡

- 交接单 `progress/reports/<任务>-r<轮>.md` 由 bk 生成模板。全部用大白话，写给不懂代码的产品负责人。
- 数据块 `pages` 写页面状态变化（ui＝前端完成，api＝已接后端）；`questions` 写要拍板的问题，格式为 `{"q": "问题", "options": ["A …", "B …"], "recommend": "A", "temp": "A"}`。
- 业务上拿不准时不要停下来等：按“原型 → docs/baseline → 最保守的做法”先取默认，写进 questions。
- 用户在对话里拍板后，写一张决定卡 `docs/decisions/D-<日期>-<短名>.md`（背景、决定、影响，10 行以内），并在数据块 `answers` 里记 `{"T032-Q1": "A"}`。

## Codex 每次会话怎么做

1. 先运行 `python3 tools/bk.py status`。
2. 按顺序判断，命中一条就停：docs/decisions/ 里还没有 D-*-kickoff.md → 先把 docs/baseline/decision-sheet.md 逐条念给用户、按回答写决定卡；有停在合并前的结果 → 提醒用户去看或去复查；“下载”文件夹里有没收的结果包 → 提醒“收包并运行”；有等拍板的问题 → 复述并给推荐；否则从“可以开始”里挑任务（并行时挑不同车道、范围不重叠的）。
3. 每次回复开头固定四行，其余用大白话：

```text
位置：<阶段> / <任务编号与第几轮>
本步：<一句话>
你要做的：<拖哪个文件、粘贴哪句话、回复什么；没有就写“无”>
我接下来：<Codex 的下一步>
```

4. 业务上的问题写成选择题并附推荐，问用户，不要自己定。同一任务到第 3 轮还没过，停下来建议：拆小、换工具或改规则（用户拍板）。
5. 每周一次（或用户说“汇总一下”）：合并了什么、勘误新增了什么、哪些问题还等拍板。

## 自动驾驶（用户说“开工”时，Codex 的边界）

- **自己做，不用问**：收包与合并（bk in）、本地预览（bk run）、每次合并成功后推送 GitHub（bk ship；没连 GitHub 就提醒）、出包（bk pack）、只需保留双方改动的冲突、本地环境问题、tool 为 Codex 的任务（bk start → 做 → bk done）；决策单第 3 条为默认时，空闲可做选做车道 G 的任务。
- **tool 以 Claude 开头的任务不自己写**：出包后告诉用户拖哪个文件、粘贴哪句话，等用户下载结果后收包。例外：用户说“这轮你来写”，或 Claude 用量用完、用户同意由你做 B 级任务。
- **必须停下来问用户**：一切业务选择（决策单、规则确认、等拍板的问题）；“先看再合并”的闸门；熔断；要用户本人操作的事（输入 sudo 密码、浏览器登录、安装 Windows 软件、上传到 Claude）；删除文件夹、改写 git 历史、修改 tools/ 与 AGENTS.md。
- 不读 handoff 文件夹外的手册（册1、册3 是给用户看的），规划只以仓库里的任务清单、AGENTS.md 和 docs/baseline 为准。

## 环境

- 网页端（Claude 沙箱）：有 Node 22、Chromium，可装 npm 包，没有 Docker。数据库测试会跳过，交给本地。任务超过 40 分钟，先运行 `bk done --checkpoint`。
- 本地（Codex，WSL2）：`bk in --latest` 收包，`bk run` 预览，`bk ship` 推 GitHub。

## 易错点（从真实错误里补，一行一条）

- TypeScript 用 6.x，不要装 7；Prisma 用 7.x，不要装 8 的候选版；ESLint 10 只用扁平配置 eslint.config.js。
- Tailwind 4 没有 tailwind.config.js；pnpm 11 不读 package.json 里的 pnpm 字段；用 Zod 4 写法；动画包名是 motion。
- React Router 只用声明式路由，不用 framework 模式；请求只用生成的钩子，不用 axios。
