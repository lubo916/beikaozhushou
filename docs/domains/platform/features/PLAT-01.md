---
id: PLAT-01
status: draft
refs:
  api: [getParams]
  events: [app_opened]
  params: [ui.loading.slow_hint_seconds]
  errors: [COMMON_UNAVAILABLE]
  inv: [INV-01]
  adr: [ADR-013, ADR-026, ADR-029]
open_questions: []
---
# PLAT-01 学员端外壳与通用状态组件

## 1 目标与边界
交付切片 0.1c、0.1d：三档外壳、七态、提议卡与撤销条，以占位和演示夹具验收。依赖 0.1b 工程前置和 PLAT-02 参数接入。必读 docs/meta/plan/loops/0.1-foundation.md、0.1-ui-contract.md 与 docs/domains/platform/PLAT-01-components.md；后者规定完整输入类型、页面/视图 API、历史记录与非法输入表现。0.1b 负责生成物、依赖/样式检查、getParams/app_opened 联调、开发身份、错误响应和低版本提示。
不交付业务页面、真实计划、正式账号、AI 内容/导师对话、离线同步或对错标记组件。外壳先用登记默认参数运行，生效参数未取得不阻塞，也不宣称已取得生效值。

## 2 业务规则
- R1 导航只列下表五项，不设分组。顺序用于底栏、抽屉、图标栏、侧栏；lucide 图标始终附可见入口文字，避免只靠图标猜含义。

|入口键|文案键（中文）|目标/路由|图标|
|---|---|---|---|
|today|nav.today（今日）|S06 /today|CalendarDays|
|learn|nav.learn（学习）|S09 /learn|BookOpen|
|practice|nav.practice（练测）|S17 /practice|ListChecks|
|tutor|nav.tutor（导师）|S28 /tutor|MessageCircle|
|me|nav.me（我的）|S34 /me|UserRound|

本表是入口/路由映射的唯一源；title/mode 不在路由配置重复保存。根路径 replace 到 /today；当前入口由 useShellLocation 返回，不跨刷新保存偏好。未知路由与演示为 standard、无选中入口（entry=null）；未知路径保留 URL 并显示“页面不存在/返回今日”。条件入口由所属功能接入。
- R2 容器查询仅用 size.breakpoint.tablet、desktop 切三档；content-md/content-lg 只管局部布局。手机为底栏与菜单按钮，菜单重复五入口；平板为带名称图标栏；桌面为五项侧栏与顶栏。页头含应用名、登记 title 和允许导航时的手机菜单按钮，改变宽度不重建内容。手机菜单为左侧 dialog 抽屉，用 size.shell.drawer 限于可用宽度；不写历史，路由变化关闭且不拦截后退。导师只提供原生 dialog 空容器、占位与路由：按 ADR-029 手机底部面板，平板/桌面右侧抽屉，用 size.shell.panel-max/drawer；内部布局与内容归 TUTOR-01/tutor_panel。打开后选中 tutor、页头取 S28 title，背景挂载且不可交互；关闭/Esc/后退返回背景并归还焦点。冷深链 /tutor 先 replace /today 再 push /tutor，规范化结束前 ready=false；关闭回 /today 主标题。分支声明、历史与焦点流程见输入契约。
- R3 页面调用 ShellPage 声明 pageId、可选 viewId 与 guided 步骤；mode 从 0.1b 生成的 packages/ui/generated/learner-pages.ts 解析，视图覆盖优先于页面值。title 是登记中文，不当文案键；不存在的视图不静默回退。演示显式注入 mode，不创建业务视图。下表给出外壳全部部件，隐藏导航同时隐藏导师，避免测评态泄露入口。

|mode|底栏/菜单抽屉/图标栏/侧栏（按三档选用）|页头/顶栏|导师|步骤条|
|---|---|---|---|---|
|standard|显示|显示|显示|无|
|guided|显示|显示|显示|显示|
|immersive|隐藏（含手机菜单按钮）|显示|隐藏|无|
|standalone|隐藏|隐藏|隐藏|无|

guided 步骤只读，不推断流程；steps 非空、id 唯一且 currentStepId 存在。非法步骤按输入契约显示 ui.input.invalid，无内容/动作。immersive/standalone 的退出由内容调用方提供。
- R4 StateView 按 state 使用输入契约中的可区分联合 props；normal 直接显示 children。七态如下；hasContent=true 时保留同一内容槽位/实例/保存值。调用方管理内容动作的禁用，StateView 仅管理自己的动作，避免隐式禁用业务内容。

|状态|无内容|有内容|必要输入|
|---|---|---|---|
|loading|骨架|内容与忙碌提示|slowHintSeconds/clock|
|empty|原因与下一步|内容与同样提示|message/action|
|error|错误与重试|内容与错误横幅|错误码/onRetry/onReport|
|offline|提示|内容与横幅|可用功能文案键列表|
|restricted|原因与出路|内容与横幅|message/action|
|insufficient_data|缺口提示|内容与区块提示|message/插值/action|
|locked|区块锁定提示|内容与区块提示|scope=block/message/action|

scope 只决定外容器所在区域/宽度，不改变上表内部结构；page 置主内容区、block 置所属区块，详见输入契约。locked/page 在编译期失败，运行时只显示 ui.input.invalid，无传入内容/动作。其他非法形状同样处理；页面决定锁定区块及 state_overrides 转键。
- R5 进入 loading 即呈现 R4 内容，达到 slowHintSeconds 显示 ui.state.still_loading，退出清理订阅。apps/learner 经 PLAT-02 访问器取 ui.loading.slow_hint_seconds 并注入；ui 不引用 params。Clock 为 now():epoch毫秒、subscribe(tick):取消订阅函数；默认每秒及返回前台时 tick，测试可推进替身。刷新节拍/单位换算是工程常量，非业务阈值。时长变更按本次加载已持续时间立即重算，避免旧计时残留。
- R6 onRetry():Promise<void>，pending 禁重复；resolve 由调用方更新 state。reject 保留内容、恢复按钮，立即显示本次映射码并调用一次 onReport({pageKey,errorCode})；state/pageKey/errorCode 变化清除本地失败，过期 Promise 不覆盖新输入。仅非 null 对象的自有 code 属于生成映射时取该码，其他为 COMMON_UNAVAILABLE；带自有 code 的 Error 同理，Orval 错误由业务层先适配。首次错误由调用方上报，每次重试失败通知一次，去重归上报层。0.1（含预发）只注入结构化桩；不展示异常原文，完整规则见输入契约。
- R7 ProposalCard 的 source 只接 planner/demo，展示“改什么、为什么、代价、不改会怎样”四项文案；确认/不改只发 Promise 回调，pending 禁重复，resolve 由调用方更新，reject 保持原态并按 R6 映射错误。编译期拒绝 AI 来源；运行时 ai/未知来源只显示 ui.proposal.unsupported_source，无正文/动作。UndoBar 接符合共同前置 RFC 3339 子集的 deadline、Clock 与 onUndo；无效时间显示 ui.undo.invalid_deadline 并禁用。正剩余时间取天/小时/分/秒中达到的最大单位向上取整，不足一秒显示一秒，以 ui.undo.remaining_* 的 count 插值；到零显示 ui.undo.expired 并禁用。失败保持原态，真实撤销以服务端结果为准，不复制计划引擎规则（ADR-013）。
- R8 EXAM_PREP_ENV 为 development/test/staging 时注册 /__demo/platform，production 不注册、不导入夹具；此环境由 0.1b 构建接线提供，不能由 URL 开启。预发即使用 Vite production 构建仍可走查。apps/learner/src/demo/platform.fixture.ts 存“演示”标签、四项文案键、固定时钟起点/截止 ISO；固定时间/演示数字只存该夹具或 tests/fixtures/**，按共同前置排除扫描，不逐处标 param-exempt，不使用真实撤销期限。待确认→确认显示撤销条→撤销恢复本地演示；不改仅触发拒绝回调，不发持久化请求。支持四 mode、七态与时钟。
- R9 样式只消费 design/tokens.json 与 tokens.resolver.json 生成的 packages/ui/generated/tokens.css；令牌/CSS/主题/容器查询/扫描见 0.1-ui-contract.md。外壳默认 light/platform/default/default；演示控件切换最外层根的浅/深色，应用内存保存，同生命周期跨路由保持，不持久化或推断系统偏好；测试入口见输入契约。cvd/large 仅编译，完整偏好归 ACCT-09。375 下文字换行、底栏等分、纵向滚动，主要动作不裁切；控件有焦点与可读名称，图标按钮有 aria-label，覆盖层约束/归还焦点。

## 3 界面
五路由的布局参考登记为 S06、S09、S17、S28、S34：只读取其 id、title、mode、views 及视图内 mode 覆盖；视图未登记 mode 时继承页面值，不新增业务视图。占位只显示登记 title 与 ui.placeholder.not_open（尚未开放），不搭建 layout_notes 业务区块；作为外壳占位免做对应页 states，真实页面落地时恢复完整要求。演示路由承担通用七态验收，不视为业务页，不展示未实现功能的业务结果。

## 4 数据
不新增表/接口。组件/类型在 packages/ui/**，路由/注入/夹具/文案在 apps/learner/**，测试在 tests/**；生成文件只改源后 gen。文案 apps/learner/src/i18n/zh-CN.json，使用 i18next/react-i18next；键空间和固定外壳中文见输入契约，含 nav.*、ui.shell.*、ui.placeholder.*、ui.input.*、ui.state.*、ui.proposal.*、ui.undo.*、demo.platform.*、error.*。数字用 {{count}} 插值，Provider 注入 t；页面键由所属功能维护。ui 不依赖 domains/db/ai/params，0.1b 的 dependency-cruiser 检查此方向。

## 5 AI 行为
无模型调用，导师仅占位。AI 内容按 R7 拒绝，待 AiContent 对接后另定规格。

## 6 验收
- PLAT-01-AC1 Playwright 在 375、834、1280 及 tablet/desktop 令牌边界前后截取外壳；五项布局/选中与导师手机底部/平板桌面右侧空容器符合 R1/R2；覆盖根路径、深链、前进后退/刷新、关闭焦点、背景保留，背景声明不污染全局 tutor/ready。
- PLAT-01-AC2 四 mode 逐格断言 R3；步骤只读；改变容器宽度后内容实例/输入值保持。
- PLAT-01-AC3 替身 Clock 测提示边界、覆盖值、运行中时长变化；提前结束加载后无旧提示；生效参数未取得时登记默认可运行。
- PLAT-01-AC4 七态和 page/block 用例符合完整输入契约；hasContent=true 内容实例/保存值不变，locked/page 及非法步骤显示 ui.input.invalid 且无内容/动作；retry pending 防重，每次 reject 上报一次且无个人信息，resolve 由调用方换态；网络故障按 R6 映射。
- PLAT-01-AC5 Playwright 截图矩阵为 /today、/learn、/practice、/tutor、/me、/__demo/platform × 375/834/1280 × light/dark；令牌断点额外截图归 AC1，仅 light。375 下入口名/动作不裁切；对比度/变量/扫描符合共同 UI 契约；cvd/large 仅编译。人工确认首份基线后回归。
- PLAT-01-AC6 测试标题同时含 [PLAT-01-AC6]、[INV-01]；验证四项、确认/不改、演示撤销、不足一秒/秒至天/到期/无效时间、失败文案，整个过程无学员状态写请求；编译期拒绝 AI source，运行时未知/AI 来源无正文/动作；预发可达演示、production 为 404。
- PLAT-01-AC7 仅键盘操作五入口、覆盖层关闭、重试、确认、不改、撤销，检查可读名称、焦点和焦点返回。
- PLAT-01-AC8 无 apps/api、账号及模型服务时外壳/演示可运行；dependency-cruiser 阻止浏览器导入 domains/db/ai、ui 导入 params。getParams/app_opened 全链路归 0.1b 联调测试。

## 7 不变量与合规
INV-01 由 AC6 承担：组件只发待确认动作回调，演示只改本地夹具；AI 在接入带标识组件前不进入正文展示。
