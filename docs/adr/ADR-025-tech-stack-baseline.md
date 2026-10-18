# ADR-025 技术栈基线

- 状态：已采纳

## 背景

技术栈改起来约等于重写，必须在行走骨架之前定下。技术选型定稿 V1.1（2026-10-18，存于归档 planning/）选择前后端分离的 TypeScript 单仓库，ADR-021 的 Next.js 全栈方案不再采用。AI 工具的训练语料新旧混杂，需要锁定版本与每件事的唯一写法。

## 决定

1. 版本纪律：大版本锁定，升级先写 ADR；补丁由 Renovate 每月合并，核心框架只升补丁版本；新发布的版本满 7 天才安装（pnpm-workspace.yaml 的 minimumReleaseAge）。只用下列登记的依赖，0.1b 起由版本锁检查与禁用库检查执行。版本陷阱同样由这两项检查拦住：TypeScript 默认最新是 7、Prisma 默认会装 8 的候选版、ESLint 10 不认 .eslintrc、pnpm 11 不读 package.json 的 pnpm 字段、Tailwind 4 没有 config 文件、Zod 4 的新写法、motion 不是 framer-motion、React Router 只用声明式路由。
2. 基线（括号内为禁用的替代）：
   - 运行时与工程：Node.js 24 LTS，上线前在 CI 双跑 26 LTS 后切换；pnpm 11 工作区；TypeScript 6.0，strict 不可关（不用 TypeScript 7、Bun、Deno、npm、yarn）。
   - 界面：React 19.2、Vite、React Router 7 声明式路由（主产品不用 Next.js）；TanStack Query 5 只用生成的钩子；Zustand 5；React Hook Form 7 与 Zod 4；Tailwind 4、shadcn/ui、lucide、sonner、motion；TipTap 3、react-markdown 10 加 rehype-sanitize、KaTeX 0.16、DOMPurify；Apache ECharts 一个图表库；i18next 与 react-i18next，先只有中文；vite-plugin-pwa 与 idb（不用 Redux、MUI、AntD、Bootstrap、Quill、Slate、MathJax、framer-motion、tailwind.config 与 v3 写法、Zod 3 写法、React Router 的 framework 模式）。
   - 设计令牌：design/tokens.json（DTCG）由 Terrazzo 生成 CSS 变量交给 Tailwind；Terrazzo 不顺手时，使用“基础值 + 主题覆盖”两层文件，由 spec_tool gen 生成。
   - 服务端：Fastify 5 只做装配；Better Auth 数据库会话（ADR-027）；BullMQ 后台任务；pino 日志；Orval 由 contracts/openapi.yaml 生成类型、Zod 校验、请求钩子与模拟数据（不用自签令牌当会话、手写请求函数、console.log）。
   - 数据：PostgreSQL 17 与 Prisma 7 多文件 schema（ADR-026）；Redis 7 与 ioredis 5 只做队列、限流与租约，不存权威数据，首版不做业务缓存；搜索用 zhparser、pg_bigm、pgvector、pinyin-pro（不用 Elasticsearch、裸连接、数据库定时任务写业务逻辑）。
   - 其他：ts-fsrs 做记忆调度；openai SDK 经 packages/ai 网关调用两家以上境内已备案模型，互为主备；导出用 Playwright 打印加 pdf-lib 写标识、exceljs、docx；date-fns 4 与 @date-fns/tz、decimal.js、uuid v7、原生 fetch（不用 moment、dayjs、axios、got、雪花 ID，也不用浮点数算钱）；Vitest 4、Playwright、MSW、ESLint 10 扁平配置与 Prettier、dependency-cruiser（不用 Jest、Cypress、madge）。
   - 云与支付：阿里云 OSS 私有桶与临时凭证、短信、内容安全、文字识别、文档智能、智能语音、视频点播；微信支付 APIv3（JSAPI、H5、Native）与支付宝官方 SDK。
3. 部署：起步一台阿里云 ECS 用 docker compose 运行 Caddy、API、Worker 与 Redis（开 AOF），数据库用 RDS PostgreSQL 17，前端静态文件放 OSS 与 CDN，日志进 SLS，错误按 Sentry 的写法上报到自建 GlitchTip，镜像存 ACR；GitHub Actions 跑全部检查，打版本标签后构建镜像；发布按备份、迁移、替换容器的顺序执行，一条命令回滚；每季度做一次恢复演练；不用 PM2，不登上服务器手工改文件。本地用同一镜像与 docker compose，自制 PostgreSQL 17 镜像带上述插件；Windows 电脑在 WSL2 中开发。
4. 落地顺序服从分期，V1.0 的“阶段”不另立刻度：阶段 0 对应 0 期，0.1b 接线并部署阿里云预发；阶段 1 对应 0.3 与 1 期，游客模式在 2.1，首个 AI 场景在 2.6（ADR-015）；阶段 2 的通知在 3.4，离线、支付、导出与注销在 4 期；阶段 3 对应 4.5 与 7 期；阶段 4 的 App 上架见 ADR-029。
5. 本 ADR 取代 ADR-021。

## 后果

- 0.1b 按本 ADR 与 ADR-026 至 ADR-029 接线：五个应用骨架、docker compose、CI 运行 verify、版本锁检查、禁用库检查与依赖方向检查。
- Prisma 7 与 Orval 输出的 Zod 4 写法要在 0.1b 用最小样例确认。
- 何时重新考虑：核心框架停止安全支持，或 0.1b 的验证发现阻断问题。
