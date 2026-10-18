---
id: PLAT-01
status: draft
refs:
  api: [getParams]
  events: [app_opened]
  params: [ui.loading.slow_hint_seconds]
  inv: [INV-01]
  adr: [ADR-013, ADR-026, ADR-029]
open_questions: []
---
# PLAT-01 学员端外壳与通用状态组件

## 1 目标与边界
交付切片 0.1c、0.1d：三档外壳、七态、提议卡与撤销条，以占位和演示夹具验收。依赖 0.1b 的工程骨架、生成产物和测试工具；参数接入依赖 PLAT-02。工程与工具基线见 docs/meta/plan/loops/0.1-foundation.md；0.1b 负责 getParams/app_opened 联调、开发身份、错误响应、低版本浏览器提示和令牌编译。
不交付业务页面、真实计划、正式账号、AI 内容/导师对话、离线同步或对错标记组件。外壳先用登记默认参数运行，生效参数未取得不阻塞，也不宣称已取得生效值。

## 2 业务规则
- R1 导航只列下表五项，不设分组。顺序用于底栏、抽屉、图标栏、侧栏；lucide 图标始终附可见入口文字，避免只靠图标猜含义。

|入口键|文案键（中文）|目标/路由|图标|
|---|---|---|---|
|today|nav.today（今日）|S06 /today|CalendarDays|
|learn|nav.learn（学习）|S09 /learn|BookOpen|
|practice|nav.practice（练测）|S17 /practice|ListChecks|
|mentor|nav.mentor（导师）|S28 /mentor|MessageCircle|
|me|nav.me（我的）|S34 /me|UserRound|

根路径 replace 到 /today；当前入口取路由，不跨刷新保存偏好。路由支持深链与前进后退。未成年人/考试扩展等条件入口由所属功能接入，本功能不建立这些入口。
- R2 容器查询仅用 size.breakpoint.tablet、desktop 切三档；content-md/content-lg 只管局部布局。手机为底栏与菜单按钮，抽屉重复五入口；平板为带名称图标栏；桌面为五项侧栏与顶栏。顶栏/页头只含应用名、当前页名及手机菜单按钮。改变宽度不重建内容。导师为路由覆盖层：手机底部面板，平板/桌面右抽屉；选中 mentor、背景页面保持挂载；关闭按钮、Esc 或后退返回原入口，焦点还给触发者。深链 /mentor 的背景与关闭落点为 /today。
- R3 mode 读取 0.1b 从页面登记生成的 packages/ui/generated/learner-pages.ts，视图覆盖优先于页面值，不手存副本。演示可注入 mode。下表包含所有全局部件，隐藏导航同时隐藏导师，避免测评态泄露入口。

|mode|底栏/菜单抽屉/图标栏/侧栏（按三档选用）|页头/顶栏|导师|步骤条|
|---|---|---|---|---|
|standard|显示|显示|显示|无|
|guided|显示|显示|显示|显示|
|immersive|隐藏|隐藏|隐藏|无|
|standalone|隐藏|隐藏|隐藏|无|

步骤输入 steps:{id,labelKey}[]、currentStepId，id 唯一且当前 id 存在，否则拒绝该输入；只读不可点击，不推断步骤。immersive/standalone 的退出由内容调用方提供。
- R4 StateView 接 state、scope(page/block)、hasContent、messageKey、messageParams、action 和 children；normal 直接显示 children。七态如下；hasContent=true 时保留 children 实例和保存值，只禁用调用方指定动作，避免丢失进度。

|状态|无内容|有内容|必要输入|
|---|---|---|---|
|loading|骨架|内容与忙碌提示|时长/时钟|
|empty|原因与下一步|内容与同样提示|原因键/action|
|error|错误与重试|内容与错误横幅|错误码/onRetry/onReport|
|offline|提示|内容与横幅|可用功能文案键列表|
|restricted|原因与出路|内容与横幅|原因键/action|
|insufficient_data|缺口提示|内容与区块提示|缺口键/插值数据/action|
|locked|区块锁定提示|内容与区块提示|scope=block/原因键/action|

locked 拒绝 page 范围；页面决定哪个预测区块锁定。组件不生成业务数字；所属页面功能负责 state_overrides 转键及登记的全部 states。
- R5 进入 loading 即呈现 R4 内容，达到 slowHintSeconds 显示 ui.state.still_loading，退出清理订阅。apps/learner 经 PLAT-02 访问器取 ui.loading.slow_hint_seconds 并注入；ui 不引用 params。Clock 为 now():epoch毫秒、subscribe(tick):取消订阅函数；默认每秒及返回前台时 tick，测试可推进替身。刷新节拍/单位换算是工程常量，非业务阈值。时长变更按本次加载已持续时间立即重算，避免旧计时残留。
- R6 onRetry():Promise<void>，pending 禁止重复点击；resolve 后调用方更新 state，reject 时保留 error、恢复按钮并调用一次 onReport({pageKey,errorCode})。首次错误由调用方上报，每次重试 reject 均通知，去重归上报层。0.1 注入上报桩，正式适配器归共同前置 0.1b 接 GlitchTip，不发送未登记埋点。错误码映射文案键，不展示原始异常，避免泄露个人信息。
- R7 ProposalCard 接 source:'plan_engine'|'manual'|'demo'、四项文案键/插值（改什么、为什么、代价、不改会怎样）、onConfirm/onDecline:()=>Promise<void>；仅发回调，pending 禁重复动作，resolve 后由调用方更新展示，reject 保留原态并显示错误键。类型不接受 AI 来源；运行时 ai/未知来源拒绝正文和动作，显示 ui.proposal.unsupported_source，待 AiContent 落地后另定接入，避免无标识展示。UndoBar 接带时区 ISO 8601 deadline、Clock、onUndo:()=>Promise<void>；无效时间禁用，pending 防重，失败保持原态且显示错误键。remaining=max(0,deadline-now)，取天/小时/分/秒中最大的非零单位向上取整，用 ui.undo.remaining_{days,hours,minutes,seconds} 的 count 插值。到期显示 ui.undo.expired 并禁用；真实撤销以服务端结果为准，界面不复制计划引擎规则（ADR-013）。
- R8 开发构建才注册 /__demo/platform，不入页面登记。apps/learner/src/demo/platform.fixture.ts 存“演示”标签、四项文案键、固定时钟起点/截止 ISO；固定测试时间与演示数字逐处注明 param-exempt，仅用于夹具，不使用真实撤销期限。待确认→确认显示撤销条→撤销恢复本地演示；不改只触发拒绝回调，不发持久化请求。演示支持四 mode、七态与时钟，避免占位被误认为真实业务。
- R9 样式只消费 design/tokens.json 与 tokens.resolver.json 的结果 packages/ui/generated/tokens.css，0.1b 用 Terrazzo 编译。当前源缺深色/间距令牌：实现前由 Codex 补齐、复核后出包，实现者只消费，不写样式数值兜底。主题约定 scheme=light/dark、vision=default/cvd、text=default/large，按 resolver 顺序叠加，brand=platform；正式外壳默认 light/default/default，演示独立切换作用于整棵外壳，不持久化、不推断系统偏好。大字号用 text.large 登记字号，不另设倍率。375 下文字可换行、底栏等分、内容纵向滚动，主要动作不裁切。可点元素有可见焦点与可读名称，图标按钮有 aria-label，覆盖层约束焦点且关闭归还。

## 3 界面
五路由的布局参考登记为 S06、S09、S17、S28、S34：只读取其 id、title、mode、views 及视图内 mode 覆盖；视图未登记 mode 时继承页面值，不新增业务视图。占位只显示登记 title 与 ui.placeholder.not_open（尚未开放），不搭建 layout_notes 业务区块；作为外壳占位免做对应页 states，真实页面落地时恢复完整要求。演示路由承担通用七态验收，不视为业务页，不展示未实现功能的业务结果。

## 4 数据
不新增表/接口。组件/类型在 packages/ui/**，路由/注入/夹具/文案在 apps/learner/**，测试在 tests/**；缺失令牌登记仅涉及 design/tokens.json、design/tokens.resolver.json，生成文件只改源后 gen。文案 apps/learner/src/i18n/zh-CN.json，采用共同前置约定的 i18next/react-i18next，平铺点分键 nav.*、ui.state.*、ui.proposal.*、ui.undo.*、demo.platform.*，数字用 {{count}} 等插值。Provider 注入 t，传入的文案键可类型检查；页面键由所属功能维护。ui 不依赖 domains/db/ai/params，浏览器依赖方向按 ADR-026。

## 5 AI 行为
无模型调用，导师仅占位。AI 内容按 R7 拒绝，待 AiContent 对接后另定规格。

## 6 验收
- PLAT-01-AC1 Playwright 在 375、834、1280 及 tablet/desktop 令牌边界前后截取外壳容器；五项布局/选中符合 R1/R2；覆盖根路径、深链、前进后退、导师覆盖关闭及背景保留。
- PLAT-01-AC2 四 mode 逐格断言 R3；步骤只读；改变容器宽度后内容实例/输入值保持。
- PLAT-01-AC3 替身 Clock 测提示边界、覆盖值、运行中时长变化；提前结束加载后无旧提示；生效参数未取得时登记默认可运行。
- PLAT-01-AC4 七态和 page/block 用例符合 R4；hasContent=true 时同一 children 实例/保存值不变，locked/page 被拒绝；retry pending 防重，每次 reject 上报一次且无个人信息，resolve 由调用方换态。
- PLAT-01-AC5 Playwright 截图覆盖浅/深色、色觉友好、大字号及大字号叠加其他主题；375 下入口名/主要动作不裁切。断言生成令牌变量生效，手写样式检查无裸色值/像素尺寸。人工确认首份截图基线后做回归比较；对错标记不在本范围。
- PLAT-01-AC6 测试标题同时含 [PLAT-01-AC6]、[INV-01]；验证四项、确认/不改、演示撤销、秒至天显示/到期禁用，整个过程无学员状态写请求；编译期拒绝 AI source，运行时未知/AI 来源不显示正文/动作。
- PLAT-01-AC7 仅键盘操作五入口、覆盖层关闭、重试、确认、不改、撤销，检查可读名称、焦点和焦点返回。
- PLAT-01-AC8 无 apps/api、账号及模型服务时外壳/演示可运行；dependency-cruiser 阻止浏览器导入 domains/db/ai、ui 导入 params。getParams/app_opened 全链路归 0.1b 联调测试。

## 7 不变量与合规
INV-01 由 AC6 承担：组件只发待确认动作回调，演示只改本地夹具；AI 在接入带标识组件前不进入正文展示。
