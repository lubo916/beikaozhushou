---
id: PLAT-02
branch: feat/PLAT-02-params
lane: 标准
started: （由 work start 填写）
---
# PLAT-02 进行中

## 计划（确认后才动代码）
- 前置：0.1b 已合入主干，接口见 docs/meta/plan/work/0.1b.md 第 3 节；本功能是闭环 0.1 第一个出包的功能。
- Codex 先做（出包前提交在本分支；这些文件 Claude 不改）：
  1. spec_tool 的 E-PARAM-03 按规格 R8 扩展扫描范围、排除项与白名单，清理或注明 0.1b 已有代码中因此出现的告警，并写工具测试；同一提交把 docs/meta/doc-system.md 第 9.3 节 E-PARAM 一行与附录 K 的 E-PARAM-03 改成新范围（检查与文档同步，AGENTS.md 红线 5）。
  2. spec_tool 的参数检查按规格 R9 增加完整性检查（说明、单位、标量数值参数的区间、出处或依据），并写工具测试。
  3. 确认 registry.generated.ts 带每个参数的整数标记，缺了就补到生成器里。
- 改动文件：
  - packages/params/index.ts（手写访问器：读取、夹取、类型校验、快照、学员取值校验）
  - packages/params/node.ts（服务端读取本环境覆盖文件与启动校验）
  - packages/params/package.json（增加服务端子路径导出）
  - packages/domains/platform/src/api/routes.ts（参数读取接口）
  - packages/domains/platform/src/index.ts（导出）
  - apps/api/src/main.ts（启动时加载覆盖文件，校验失败以非零状态退出）
  - apps/api/src/app.ts（覆盖来源作为构建选项，测试可注入）
  - apps/learner/src/params.ts（学员端启动时取快照）
  - apps/learner/src/main.tsx（启动时调用快照加载）
  - deploy/params/development.json
  - deploy/params/test.json
  - deploy/params/staging.json
  - deploy/params/production.json
- 参考文件：
  - contracts/params.yaml
  - packages/params/registry.generated.ts
  - packages/contract/src/
  - packages/domains/platform/package.json
  - apps/api/src/env.ts
  - apps/api/src/context.ts
  - apps/api/src/errors.ts
  - ./vitest.config.ts（仓库根下的文件写成 ./ 开头，交接脚本才能识别）
- 契约变更：无。getParams 的公开标注、两个工程参数的依据说明、免打扰时段默认值的写法都已随规格批次合入。
- AC → 测试：
  - PLAT-02-AC1 → packages/params/index.test.ts：[PLAT-02-AC1] 未登记的参数名类型检查报错，运行时抛出含名称的错误（用类型断言注释验证编译期报错，由 typecheck 执行）
  - PLAT-02-AC2 → apps/api/src/params.test.ts：[PLAT-02-AC2] getParams 返回覆盖值与默认值，逐项等于服务端访问器
  - PLAT-02-AC3 → packages/params/node.test.ts：[PLAT-02-AC3] 覆盖文件的三处问题一次列出；apps/api/src/main.test.ts：[PLAT-02-AC3] 覆盖文件不合格时进程以非零状态退出
  - PLAT-02-AC4 → packages/params/node.test.ts：[PLAT-02-AC4] 越界取最近端点并写一条告警
  - PLAT-02-AC5 → apps/learner/src/params.test.ts：[PLAT-02-AC5] 快照成功时覆盖、未登记名称忽略；失败时用默认值且不再请求（MSW 模拟接口）
  - PLAT-02-AC6 → packages/params/index.test.ts：[PLAT-02-AC6] 学员取值校验：区间内、端点、区间外、无学员区间
  - PLAT-02-AC7 → tests/tooling/test_param_literals.py：[PLAT-02-AC7]（Codex 写，先做第 1 项；标签写在测试方法文档字符串首行，0.1b 起由 verify 运行并计入结果）
  - PLAT-02-AC8 → tests/tooling/test_params_registry.py：[PLAT-02-AC8]（Codex 写，先做第 2 项；标签写在测试方法文档字符串首行，0.1b 起由 verify 运行并计入结果）
- 实现要点（给实现者）：
  1. 主入口只做与运行环境无关的事（取值、夹取、校验、快照）；读文件放服务端子路径，学员端只导入主入口。
  2. 覆盖文件位置：仓库根下的部署参数目录，按 getEnv() 的环境名取文件；构建选项可直接传入覆盖对象，测试不读真实文件。
  3. 启动校验收集全部问题后一次报出；越界告警走 pino，字段为参数名、原值、生效值。
  4. 学员端快照只请求一次，用 0.1b 生成的 getParams 请求函数，不手写 fetch；快照只影响此后的读取。
  5. 测试中的时间、日志都用可注入的替身；不出现参数数值字面量，取值一律从登记数据读。
  6. 读取参数保持 `param("<参数名>")` 的调用形式：spec_tool 的 E-PARAM-01 与 W-PARAM-02 按这个形式识别代码里的参数引用。
- 风险与不确定：
  1. E-PARAM-03 扩到界面代码后，0.1b 已有代码可能报告警，由 Codex 在先做第 1 项时处理，避免实现轮次被工具问题打断。
  2. 整数标记依赖 YAML 写法：默认值写成整数即按整数校验，写成小数即按小数；登记时注意写法。
  3. 参数与考试无关，测试约定第 3 条（覆盖主种子与对照考试）不适用，复查记录中注明。
  4. getParams 返回全部参数（OQ-PLAT-02-2 的临时默认）；如负责人改为只返回部分参数，需要先在登记里加可见性字段，属重型通道。
- 确认：（谁、何时）

## 决定
（会话中做的取舍，一行一条，行尾写去向：→ 规格 R<n> / → ADR-<nnn> / → 不保留。）

## 进度
- [ ] Codex：先做三项并提交
- [ ] 出包第 1 轮
- [ ] 回包、verify、按 review-change 复查
- [ ] work close、PR、CI 全绿后合并

## 交接记录
| 时间 | 工具 | 做了什么 | 下一步 |
|---|---|---|---|

## 包外读取
（读了任务包以外的文件时记一行：文件与原因。）

## 复核
（冷启动复核与异构复查的结论。）

## 未决
