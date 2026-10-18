# ADR-003 三端单仓库

- 状态：已采纳

## 背景

学员端、机构端、平台后台共用学习者模型、计划引擎与题库，但部署节奏、鉴权域与界面密度不同。功能大多同时改领域代码与某一端的页面；两个 AI 工具都从仓库根启动。

## 决定

1. 一个 pnpm workspace：apps/learner、apps/org、apps/admin 是三个独立部署的应用，各自持有页面、路由与鉴权入口。
2. packages/domains/<领域> 是与界面框架无关的领域代码，不依赖 apps/；对外只暴露包入口。
3. packages/ui 放组件、页面状态组件、AI 内容组件与导师面板界面；packages/params 是生成的参数访问器；packages/ai/<场景> 放提示词、输出结构与调用代码；packages/db 构造唯一的数据库客户端。
4. 依赖方向：apps → packages/domains → packages/db、packages/params；packages/ui 只被 apps 依赖；方向由依赖检查守护。
5. 表结构以 contracts/schema/*.yaml 为唯一来源（字段带数据类别与 owner，供 E-DC 与 E-OWN 检查）；数据库迁移与客户端代码由它生成，不手写第二份结构定义。

## 后果

- 端只做呈现与交互，领域代码不按端写分支。
- 依赖未安装时（无 node_modules），verify 跳过 lint、类型检查与测试（scripts/spec_tool.toml 的 stack_marker）。
- 何时重新考虑：某一端需要原生应用或小程序时，在 apps/ 下增加端，不改领域包。
