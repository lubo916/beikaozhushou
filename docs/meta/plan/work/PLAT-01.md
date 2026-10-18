---
id: PLAT-01
branch: feat/PLAT-01-shell
lane: 标准
started: （由 work start 填写）
---
# PLAT-01 进行中

## 计划（确认后才动代码）
- 前置：0.1b、PLAT-02、METR-01 都已合入主干；0.1b 已补齐学员端 834 截图，令牌生成器能处理新增的修饰器（见 docs/meta/plan/work/0.1b.md 第 2 节 C7 与第 3 节）。
- Codex 先做（出包前提交在本分支；这些文件 Claude 不改）：
  1. 确认 0.1b 的样式字面量检查覆盖 apps/learner 与 packages/ui 的 CSS、className 与 style；没有覆盖就先补上并写反例测试。
  2. 确认任务包仍在预算内（当前约 12,900 字符，上限 15,000）。
  3. 确认 scripts/handoff.py 回包时，写入的文件命中 design/tokens.json 或 design/tokens.resolver.json 会运行 gen（0.1b.md 第 2 节 C9）；否则回包后 tokens.css 不更新，verify 必然失败。
- 改动文件：
  - design/tokens.json（外壳尺寸、间距、遮罩与阴影令牌）
  - design/tokens.resolver.json（深色修饰器）
  - packages/ui/src/state-view/（状态组件与骨架）
  - packages/ui/src/proposal/（提议卡与撤销条）
  - packages/ui/src/i18n/zh-CN.json（通用组件文案）
  - packages/ui/src/index.ts（导出）
  - apps/learner/index.html（应用模块之前的浏览器能力检查与过旧提示）
  - apps/learner/src/main.tsx（能力检查不通过时不挂载；挂载外观与打开上报）
  - apps/learner/src/App.tsx（路由根）
  - apps/learner/src/routes.tsx（全部页面、未知地址与演示页的路由）
  - apps/learner/src/shell/（导航配置、三档布局、顶栏、底栏、抽屉、弹出列表、页面模式）
  - apps/learner/src/pages/（占位页与页面不存在）
  - apps/learner/src/demo/（演示页，只在非生产构建中注册）
  - apps/learner/src/appearance.ts（跟随系统的浅色与深色）
  - apps/learner/src/telemetry/app-opened.ts（启动与回到前台时上报）
  - apps/learner/src/i18n/zh-CN.json（学员端外壳与演示页文案）
  - apps/learner/src/styles.css（外壳用到的令牌类）
- 参考文件：
  - apps/learner/src/generated/pages.ts
  - apps/learner/src/params.ts
  - apps/learner/src/api/query-client.ts
  - apps/learner/vite.config.ts
  - packages/ui/src/generated/tokens.css
  - packages/ui/src/theme.css
  - packages/params/index.ts
  - packages/contract/src/
  - ./playwright.config.ts（仓库根下的文件写成 ./ 开头，交接脚本才能识别）
  - ./vitest.config.ts
  - design/screens/shots/S06/normal@375.png（手机布局参考）
  - design/screens/shots/S06/normal@834.png（平板布局参考，0.1b 补齐）
  - design/screens/shots/S06/normal@1280.png（桌面布局参考）
  - design/screens/shots/S03/time@1280.png（引导页参考）
  - design/screens/shots/S01/first@375.png（独立页参考）
  - design/screens/shots/S18/obj@375.png（沉浸页参考）
- 契约变更：无接口、表与参数变更。design/tokens.json 与 tokens.resolver.json 新增令牌与深色修饰器，属于设计值，随本功能提交。
- AC → 测试：
  - PLAT-01-AC1 → tests/e2e/shell/navigation.spec.ts：[PLAT-01-AC1] 三档导航、断点两侧、可达页面集合与选中态
  - PLAT-01-AC2 → tests/e2e/shell/routes.spec.ts：[PLAT-01-AC2] 根路径、占位页与未知地址
  - PLAT-01-AC3 → tests/e2e/shell/modes.spec.ts：[PLAT-01-AC3] 四种模式的外壳与“返回”
  - PLAT-01-AC4 → packages/ui/src/state-view/state-view.test.tsx：[PLAT-01-AC4] 慢加载提示、空态、出错态、重试与上报（浏览器模式，替身时钟）
  - PLAT-01-AC5 → packages/ui/src/proposal/proposal.test.tsx：[PLAT-01-AC5] 提议卡回调与撤销条剩余时间
  - PLAT-01-AC6 → tests/e2e/shell/demo.spec.ts：[PLAT-01-AC6] 预发构建的演示页；apps/learner/src/routes.test.ts：[PLAT-01-AC6] 生产构建不注册演示页
  - PLAT-01-AC7 → tests/e2e/shell/app-opened.spec.ts：[PLAT-01-AC7] 启动与回到前台各上报一次，切换路由不上报，上报失败外壳照常（拦截请求计数）
  - PLAT-01-AC8 → tests/ui/token-contrast.test.ts：[PLAT-01-AC8] 浅色、深色叠加修饰器的对比度；tests/e2e/shell/visual.spec.ts：[PLAT-01-AC8] S06 占位页与演示页截图基线
  - PLAT-01-AC9 → tests/e2e/shell/keyboard.spec.ts：[PLAT-01-AC9] 只用键盘走完导航、抽屉、弹出列表与演示操作
  - PLAT-01-AC10 → tests/e2e/shell/old-browser.spec.ts：[PLAT-01-AC10] 能力检查不通过时只显示过旧提示（页面脚本运行前注入不支持的能力）
- 实现要点（给实现者）：
  1. 导航配置只有一份（分组、组内顺序、字徽、底栏入口与所含分组），三档布局与测试都读它；页面名称与 mode 从生成的页面清单读取，不手抄。
  2. 三档用容器查询：外壳根是查询容器，断点取令牌生成的容器尺寸，不写视口媒体查询，也不写像素条件。
  3. 抽屉与弹出列表按对话框处理：打开时焦点移入，Esc、遮罩、路由变化都关闭，关闭后焦点回到触发按钮；平板上只有一页的分组直接跳转。
  4. 状态组件不读参数、不发请求：慢加载秒数、时钟、文案键、重试与上报回调都由调用方传入；学员端用 PLAT-02 的访问器读 ui.loading.slow_hint_seconds 后传入。
  5. 撤销条的截止时间由调用方传入；演示页用确认时刻加 plan.proposal.undo_days 天算出。显示：天与小时向下取整，不足一小时的分钟向上取整。
  6. 打开上报：启动时一次；visibilitychange 由 hidden 变为 visible 时一次；用生成的 trackEvent 请求函数，每次发生生成一个 UUIDv7 作幂等键；失败不重试。
  7. 外观：根元素的 data-scheme 跟随 prefers-color-scheme 并监听系统切换；演示页的外观切换只改内存，色觉友好与大字号只在演示页切换。
  8. 浏览器能力检查是 index.html 里位于应用模块之前的内联脚本；不支持时把提示写进页面并设标记，main.tsx 见到标记就不挂载。
  9. 文案：通用组件的键在 packages/ui 的文案文件，外壳与演示页的键在 apps/learner 的文案文件，数字用插值。
  10. 字徽是文字徽标，不引入新的图标或界面依赖。
- 原型外壳取值（登记为令牌后使用，单位 px，来自原型外壳样式）：
  - 桌面：侧栏宽 236；顶栏高 56，左右内边距 20；内容区内边距上 22、左右 24、下 48；侧栏链接左缩进 38，当前页左侧 3 宽主色条；侧栏字徽 22。
  - 平板：图标栏宽 72；字徽按钮宽 62，按钮内字徽 28；弹出列表宽 230、内边距 8、圆角 12，贴在图标栏右侧；内容区内边距 18。
  - 手机：顶栏高 52、左右内边距 10；抽屉宽 300 且不超过容器的 86%；底栏每项纵向排列字徽 22 与文字，上下内边距 6，底部加安全区；内容区内边距 14。
  - 通用：顶栏图标按钮 36；圆角用已有的 radius.sm 与 radius.md；遮罩 rgba(12,18,32,0.36)；抽屉阴影 8 0 28 rgba(15,25,45,0.2)；弹出列表阴影 0 12 32 rgba(20,30,55,0.16)。
- 风险与不确定：
  1. 截图基线只在固定版本的 Linux 镜像中生成与比对；首次基线由产品负责人在本功能复查时看过截图后确认，确认后再合并。
  2. 深色取值属于设计判断：实现者按 R9 的对比度要求给出，负责人在演示页走查时确认，之后的微调走轻量通道。
  3. 演示页与占位页不构成业务页面，页面登记的 states 由各页功能实现（规格第 3 节）；复查时不按业务页要求七态。
  4. 只有 S01 至 S35 的路由；S21、S26 有路由但不进导航（规格第 1 节）。
  5. 任务包接近预算，规格如需补充 refs，先量体量。
- 确认：（谁、何时）

## 决定
（会话中做的取舍，一行一条，行尾写去向：→ 规格 R<n> / → ADR-<nnn> / → 不保留。）

## 进度
- [ ] Codex：先做三项
- [ ] 出包第 1 轮
- [ ] 回包、verify、按 review-change 复查；负责人看截图基线
- [ ] work close、PR、CI 全绿后合并

## 交接记录
| 时间 | 工具 | 做了什么 | 下一步 |
|---|---|---|---|

## 包外读取
（读了任务包以外的文件时记一行：文件与原因。）

## 复核
（冷启动复核与异构复查的结论。）

## 未决
