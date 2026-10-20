# 备考助手（exam-prep）

AI 通用备考产品，包含学员端、机构端和平台后台。协作规则以 AGENTS.md 为准，任务与进度由 tools/bk.py 维护，产品地基见 docs/baseline/，用户拍板的决定见 docs/decisions/。

## 日常推进

用户对 Codex 说“开工”。Codex 先看状态，按 AGENTS.md 收包、验证、预览、推送或出下一包；业务选择和规定的验收闸门仍请用户拍板。Claude 任务通过 bk 生成的压缩包交接。

```sh
python3 tools/bk.py status
python3 tools/bk.py where
python3 tools/bk.py in --latest
python3 tools/bk.py run
python3 tools/bk.py ship
```

中转文件夹默认在仓库旁的 handoff/；具体位置以 bk where 为准。结果包可下载到 Windows“下载”文件夹。

## 原型与保留资料

冻结原型是 design/prototype/prototype.html，通过下面的命令查看页面说明与截图：

```sh
python3 tools/bk.py spec S06
python3 tools/bk.py proto S06 --views
```

截图按需生成到 .bk/proto/，不提交旧截图和重复 HTML 切片。design/screens/ 下70份页面 YAML 保留业务条目；术语、参数、契约、算法说明、产品 ADR 与 docs/history/v3/ 中的约定和领域草稿保留，供任务简报按需引用。F01 还需从 v3-final 标签读取旧一致性检查脚本。

V3 的推进脚本、旧工作流、旧出包与规格审批流程已退役；历史原件可通过 v3-final 标签找回。无需重新安装旧钩子或使用旧 drive 流程。

## 现有工程与后续校准

Windows 本地在 WSL2 的 Ubuntu 文件系统中开发。依赖与版本以 docs/baseline/tech.md 为准；F02 负责校准工程骨架、生成命令与新版 CI。

现有应用、共享包、测试、契约生成器及部署脚本继续保留。当前已有的工程命令包括：

```sh
pnpm contract:gen
pnpm db:generate
pnpm dev:api
pnpm dev:learner
pnpm lint
pnpm typecheck
pnpm test
pnpm deps:check
```

本地环境值写在不提交的 .env，变量说明见 .env.example。deploy/ 保留数据库镜像、Compose、发布和回滚资产；新版验证与上线流程按对应任务验收，不沿用已退役的 CI 自动部署入口。
