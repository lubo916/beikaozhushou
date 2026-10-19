# 技术栈与环境

> 来源：《技术选型定稿 V1.1》与 ADR-025～029。本文件是 AI 查技术栈的唯一入口；“已锁定版本”表由 F02 按实际安装结果填写。

## 一句话

前后端分离的 TypeScript monorepo：三个界面都是纯前端（React + Vite），只经一个 Fastify API 读写数据；慢活交给 BullMQ 后台进程；数据在 PostgreSQL 17；本地与线上用同一个 Docker 镜像，部署在阿里云。

## 目录

```text
apps/learner   学员端（React 19 + Vite + React Router 7 声明式路由）
apps/org       机构端
apps/admin     平台后台（单独域名）
apps/api       唯一后端（Fastify 5），只负责装配各领域的路由
apps/worker    后台任务（BullMQ）：解析、夜间顺延、提醒、导出
packages/domains/<领域>  业务规则、数据访问、本领域的路由与任务处理器
packages/contract        由 contracts/openapi 生成：类型、Zod 校验、请求钩子、MSW 假数据（生成物不进 git）
packages/db              Prisma 客户端与连接（多文件 schema，一个领域一个文件）
packages/ai              core 是 AI 网关；<场景>/ 放提示词与输出结构
packages/params          由参数表生成的参数访问器（生成物不进 git）
packages/ui              组件、七态组件、令牌产物，只给三个界面用
packages/shared          词汇常量、通用类型（前后端都能用的纯函数与常量）
contracts/openapi        接口契约源文件（_common.yaml、schemas/、pages/）
fixtures/                演示考试数据（假数据、种子、测试共用）
tests/                   e2e、api、db、rules 测试
deploy/                  Dockerfile、compose、发布与回滚脚本
tools/                   bk.py 等工具（Python 与 Node 脚本，不进线上）
design/prototype/        冻结原型（只读；用 bk spec / bk proto 看）
```

领域（packages/domains 与功能编号前缀）：learner、plan、map、practice、grading、tutor、exam、content、moderation、org、account、billing、aigov、compliance、metrics、engagement、support、platform。

## 版本基线（大版本锁定，升级先写决定卡）

| 层 | 选择 | 不要用 |
|---|---|---|
| 运行时 | Node 24 LTS（本地与线上）；开发与测试兼容 Node 22.12+（网页沙箱是 22） | Bun、Deno、奇数版本 |
| 包管理 | pnpm 11 工作区，packageManager 写确切版本 | npm、yarn；package.json 里的 pnpm 字段 |
| 语言 | TypeScript 6.0.x，strict | 7.x；any |
| 界面 | React 19.2、Vite、React Router 7（只用声明式） | Next.js；React Router framework 模式 |
| 数据与表单 | TanStack Query 5（只用生成的钩子）、Zustand 5、React Hook Form 7、Zod 4 | Redux；页面里手写请求；Zod 3 写法 |
| 样式 | Tailwind 4、shadcn/ui、lucide、sonner、motion | tailwind.config.js；MUI、AntD；framer-motion 旧包名 |
| 内容 | TipTap 3、react-markdown 10 + rehype-sanitize + KaTeX、DOMPurify | 不过滤直接输出 HTML |
| 图表 | Apache ECharts（按需引入）；掌握方格用普通组件 | 多个图表库并存 |
| 文案 | i18next + react-i18next（先只有中文） | 组件里写死文案 |
| 离线 | vite-plugin-pwa + idb + 统一待提交队列 | 各页各写一套 |
| 后端 | Fastify 5、Better Auth（数据库会话）、BullMQ、pino | 自签 JWT 当会话；console.log |
| 数据 | PostgreSQL 17 + Prisma 7（多文件 schema）；Redis 7 + ioredis | Prisma 8 候选版；裸 pg |
| 搜索 | zhparser、pg_bigm、pgvector、pinyin-pro | Elasticsearch；LIKE '%词%' |
| 契约 | Orval（类型、Zod、钩子、MSW） | 手写请求与校验 |
| 记忆算法 | ts-fsrs | 自己推导间隔公式 |
| AI | openai SDK 调境内已备案模型，唯一出口 packages/ai/core | 多个模型 SDK；境外模型 |
| 工具库 | date-fns 4 + @date-fns/tz、decimal.js（金额存整数分）、uuid v7、原生 fetch | moment、dayjs、axios；浮点算钱 |
| 测试 | Vitest 4、Playwright、MSW、ESLint 10 扁平配置、Prettier、dependency-cruiser | Jest、Cypress、.eslintrc |
| 运维 | Docker + compose、阿里云 ACR/ECS/RDS/OSS、Caddy、日志服务、GlitchTip | PM2；登服务器手改 |

## 已锁定版本（F02 填写）

| 包 | 版本 |
|---|---|
| （F02 按实际安装填写） | |

## 生成物

接口代码（packages/contract/src/generated）、Prisma 客户端、参数访问器都由 `pnpm gen` 生成，不进 git；`dev`、`test`、`build`、`typecheck` 之前自动运行 `gen`。这样并行的任务不会在生成文件上冲突。

## 网页沙箱（claude.ai 代码执行）注意事项

- 环境：Ubuntu、root、Node 22、Python 3.12、git、Chromium（路径由 bk 探测，传给 Playwright 的环境变量 BK_CHROMIUM）。没有 Docker。
- 网络：默认只能访问包管理器（npm、PyPI、GitHub 等）。仓库里的 .npmrc 不能写死国内镜像，否则沙箱装不了依赖；需要镜像的，写在你自己电脑的用户级配置里。
- 单个上传或下载文件最大 30 MB：压缩包不带 node_modules 和构建产物；大文件不进仓库。
- 数据库：可以试 `bk start <任务> --with-db`（调用 tools/sandbox-db.sh 用 apt 装 PostgreSQL 与 Redis）；装不上就只跑不需要数据库的测试，数据库测试以本地为准。

## 本地环境（你的电脑）

- Windows：在 WSL2（Ubuntu）里开发，仓库放在 WSL2 的文件系统里；Docker Desktop 打开 WSL2 集成；Codex 在 WSL2 里打开仓库。
- Node 24（用 nvm 或 fnm 安装）、pnpm（`corepack enable`）、Docker Desktop、Python 3、git。
- `python3 tools/bk.py doctor` 会逐项检查并给出办法。

## 部署（阶段 3）

起步用一台 ECS 跑 docker compose（Caddy、API、Worker、Redis），数据库用 RDS PostgreSQL 17，资料放 OSS 私有桶，前端静态文件放 OSS + CDN。GitHub Actions 构建镜像推到 ACR；一条命令发布（先备份、再迁移、再换容器），一条命令回滚。上线前置事项（ICP 备案、生成式 AI 备案或登记、短信签名、支付商户）周期比写代码长，要尽早办。

## V4.1 补充

- **领域两层**：`packages/domains/<领域>/core`（纯函数、无服务端依赖，ESLint 与 dependency-cruiser 检查）给模拟层和服务器共用；`server` 放 Prisma、路由与任务处理器。
- **pnpm 11 的安装脚本**：默认不运行依赖的安装脚本，esbuild 这类需要登记到允许名单才装得上（F02 配好，沙箱与本地都要能装）。
- **沙箱里的 Node**：`bk start` 会尝试经 npm 仓库装 Node 24（另一份方案实测约 5–10 秒）；装不上就用沙箱自带的 22，项目仍兼容 22.12 以上。不想装时设环境变量 BK_SKIP_TOOLCHAIN=1。
- **沙箱数据库**：`bk start <任务> --with-db` 调用 tools/sandbox-db.sh，用 apt 装 PostgreSQL 16 与 Redis（另一份方案实测约 15 秒）；zhparser、pg_bigm 装不上，相关测试以本地为准。
- **数据结构冻结**：首批邀请用户之前（任务 LF）冻结一次。冻结前不写迁移文件，改 schema 后用 `prisma db push` 加种子重建；冻结后一律走迁移。`bk done` 按 tools/bk.config.json 的 schema_frozen 自动检查。
- **压缩包上限**：帮助中心的上传上限页面同时出现过 30 MB 与更大的写法，按 25 MB 封顶最稳妥（bk 已设为 25）。
- **Claude Code 网页版**（可选通道，见册1附录 C）：云端约 4 核、16 GB 内存，预装 Node、pnpm、Docker、PostgreSQL 16、Redis 7，能跑数据库测试；环境里可设一个准备脚本（装 Node 24 与 pnpm 11），结果会被缓存。以官方文档为准。
