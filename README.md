# 备考助手（exam-prep）

AI 通用备考：学员端、机构端、平台后台。AI 工具的常驻指令见 AGENTS.md；人的日常操作见 docs/meta/ops-card.md；推进开发见 docs/meta/plan/README.md（在 Codex 中调用 drive 技能）；分期与当前进度见 `python3 scripts/spec_tool.py status`。

新机器第一次使用：

```sh
pip install pyyaml
git config core.hooksPath .githooks
python3 scripts/spec_tool.py doctor
python3 scripts/spec_tool.py status
```

归档材料（原型 v1.0、深化来源、旧模块文档、分期规划与实施步骤表）放在同级目录 ../exam-prep-archive，开发会话不读；冻结原型是唯一例外：网页版 Claude 写明需要时，随规格编写包送达（ADR-030）。

## 本地开发

需要 Node 24、pnpm 11（`corepack enable`）、Python 3.12 与 PyYAML、Docker；Windows 电脑在 WSL2 中开发（ADR-025）。

```sh
corepack enable
pnpm install
cp .env.example .env                        # 按说明填写；本机连接串见下
docker compose -f deploy/compose.yaml up -d # PostgreSQL 17（zhparser、pg_bigm、pgvector）与 Redis 7
python3 scripts/spec_tool.py gen            # 生成物；依赖装好后同时运行 pnpm contract:gen
pnpm db:generate                            # Prisma 客户端（生成到 packages/db/generated/，不进仓库）
pnpm db:migrate                             # 应用迁移
pnpm db:seed                                # 平台默认租户与固定开发者账号（学员、游客各一）
pnpm dev:api                                # API：http://localhost:3000，健康检查 /healthz
pnpm dev:learner                            # 学员端：http://localhost:5173，/api 转给本机 API
python3 scripts/spec_tool.py verify --full  # 完成标准
```

本机 compose 的 PostgreSQL 只监听 127.0.0.1、不设口令，连接串写成：
`DATABASE_URL=postgresql://exam_prep@localhost:5432/exam_prep`，`TEST_DATABASE_URL=postgresql://exam_prep@localhost:5432/exam_prep_test`，`REDIS_URL=redis://localhost:6379`。

常用命令：`pnpm lint`（Prettier、ESLint 与样式字面量检查）、`pnpm typecheck`、`pnpm test`（node、db 与浏览器三个项目）、`pnpm e2e:smoke`、
`pnpm deps:graph`（依赖方向）、`pnpm deps:check`（版本锁与禁用库）、`pnpm contract:gen`（接口生成物）。截图基线只用
`scripts/engineering/e2e-in-image.sh --update-snapshots` 在固定版本的 Playwright 镜像中生成。

## 构建与部署

CI（.github/workflows/ci.yml）在每个 PR 与主干提交上运行 `python3 scripts/spec_tool.py verify --full`。主干的 verify 通过后：
构建 api 与 worker 共用的镜像 exam-prep-server（deploy/Dockerfile）和带学员端静态文件的入口镜像 exam-prep-web（deploy/web.Dockerfile，Caddy），
推送到阿里云 ACR；构建学员端、机构端与后台的静态文件（构建模式 staging，作为构建产物上传）；再经 SSH 在预发 ECS 上运行 `release.sh <标签>`。verify 失败时不构建、不部署。

预发（ECS 一台，docker compose 运行 Caddy、api、worker 与 Redis；数据库为 RDS PostgreSQL 17）：

- 部署目录（默认 /srv/exam-prep）放 compose.staging.yaml、release.sh、rollback.sh（每次发布由 CI 同步）与 .env（只在服务器上填写，变量见 .env.example）。
- 发布：`./release.sh <标签>`，依次备份数据库（backups/，保留 BACKUP_KEEP 份）、迁移并写入种子、替换容器（等健康检查通过）、记录版本（state/current、state/previous）。
- 回滚：`./rollback.sh`，一条命令回到上一版镜像。迁移只前进不回退，上一版镜像须兼容当前表结构；需要恢复数据时用 backups/ 中的备份。
- 访问：ICP 备案完成前用 ECS 公网 IP 以 HTTP 访问（EXAM_PREP_SITE_ADDRESS 留空）；有备案域名后填入该变量，Caddy 自动签发证书。
- 耗时：每次发布与回滚的耗时记入 state/history.tsv。首次部署与回滚的实测耗时尚未测量，首次预发部署后记在这里（0 期观测指标要用）。

GitHub Secrets（仓库 Settings → Secrets and variables → Actions；部署作业使用 staging 环境）：
ACR_REGISTRY、ACR_NAMESPACE、ACR_USERNAME、ACR_PASSWORD（镜像仓库）；STAGING_HOST、STAGING_USER、STAGING_SSH_KEY、STAGING_SSH_KNOWN_HOSTS（预发服务器的 SSH 登录）；
STAGING_DIR（可选，部署目录）。

预发 ECS 的 .env：DATABASE_URL（RDS 内网地址）、EXAM_PREP_ENV=staging、ACR_REGISTRY、ACR_NAMESPACE；可选 EXAM_PREP_SITE_ADDRESS、BACKUP_KEEP、LOG_LEVEL 与固定开发者身份 EXAM_PREP_DEV_*。
