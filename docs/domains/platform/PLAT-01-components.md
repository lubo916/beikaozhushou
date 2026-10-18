# PLAT-01 外壳与组件输入契约

本文是 features/PLAT-01.md 草稿的必读组成部分；下列接口属于待实现目标，不能据此认定工程已经交付。页面内容仍以 design/screens/ 为源，路由与入口映射只以 PLAT-01 R1 为源。令牌、CSS 变量和样式检查见 docs/meta/plan/loops/0.1-ui-contract.md。

## 页面登记、视图与外壳上下文

0.1b 的 learner-pages.ts 从学员端登记生成下列只读结构。title 是登记中的中文原文，直接作页头文字；它不是文案键。view.mode 只在登记存在覆盖时生成。页面 ID、视图 ID 和页面模式的联合类型从实际登记生成，不手工枚举另一份事实。

```ts
type PageMode = 'standard' | 'guided' | 'immersive' | 'standalone';
type PageRegistration = Readonly<{
  id: LearnerPageId;
  title: string;
  mode: PageMode;
  views: readonly Readonly<{ id: string; mode?: PageMode }>[];
}>;
declare const LEARNER_PAGES: Readonly<Record<LearnerPageId, PageRegistration>>;
type Step<K extends string> = Readonly<{ id: string; labelKey: K }>;
type Steps<K extends string> = Readonly<{ items: readonly Step<K>[]; currentStepId: string }>;
type ShellPageProps<K extends string> = Readonly<{
  pageId: LearnerPageId;
  viewId?: string;
  steps?: Steps<K>;
  children: ReactNode;
}>;
type EntryKey = 'today' | 'learn' | 'practice' | 'tutor' | 'me';
type ShellLocation = Readonly<{
  ready: boolean;
  entry: EntryKey | null;
  pageId?: LearnerPageId;
  viewId?: string;
  mode: PageMode;
}>;
declare function useShellLocation(): ShellLocation;
```

路由元素以 ShellPage 包住内容并声明当前页面；真实页面切换视图时更新 viewId，不从 URL 猜业务视图。省略 viewId 时用页面 mode；提供 viewId 时必须是该页面已登记值，并按“视图 mode 覆盖→页面 mode”解析。只有最终模式为 guided 才接受且要求 steps：items 非空、id 非空且唯一、currentStepId 存在，标签键有效。其他模式不得传 steps。步骤只读，不负责业务跳转或推断流程。演示以独立 DemoShellPage 显式给 mode/steps，不伪装页面登记。

R1 五页占位只传 pageId，不选择业务视图；因此它们的初始 mode 直接取登记。当前页名取 LEARNER_PAGES[pageId].title，入口文字仍取 nav.*。ShellPage 的 pageId 与自身分支的路由映射不一致、未知页面/视图或错误步骤均按下节非法输入处理，避免显示错误页头。

应用只建一个 ShellController，公开 useShellLocation 始终读它发布的全局前景快照，不读最近的局部页面 Provider。覆盖路由使用独立的前景/背景 Routes location 上下文：背景按保存的 backgroundLocation 匹配路由，前景按当前 /tutor 匹配；每个 ShellPage 仅按自己的分支 location 校验。控制器给分支分配唯一 token，ShellPage 只提交/更新该 token 的局部声明；控制器按当前前景 token 选择并发布全局快照，背景声明不能覆盖它。清理仅能移除对应 token 的本次声明，旧清理不能清除新声明；StrictMode 重挂不会抢占当前前景。前景合法声明未就绪时 ready=false。DemoShellPage 使用隔离局部上下文，不向全局注册。tutor 覆盖期间全局为 S28/tutor，外壳页头与 dialog 可读标题均取 S28 登记 title（AI 导师），背景页保留其局部声明和挂载实例；宽度或模式变化不改变 entry。

根路径 replace 到 /today。未知路径保留原 URL，显示 standard 的 404 外壳，entry=null；页头为 ui.shell.not_found，内容为 ui.shell.route_not_found，唯一动作 ui.shell.back_today replace 到 /today。/__demo/platform 也为 standard、entry=null；演示区内的 mode 夹具只影响被测嵌套外壳。公开钩子只报告最外层路由，不把演示夹具变为真实入口。ready=false 表示初始路由尚未规范化；0.1b 在 ready 且 entry 非空时才取得 app_opened.entry。

## 空导师容器与历史记录

PLAT-01 只交付原生 HTML dialog 空容器、可读标题、关闭按钮、占位文字及路由/焦点管理，不安装 Radix/vaul 等新依赖。按 ADR-029，手机空容器贴底、宽度占满外壳、高度不超过 size.shell.panel-max 与可用高度；平板/桌面空容器为右侧抽屉，宽度取 size.shell.drawer 并不超过外壳宽度。尺寸与留白只用 ui 令牌。内部面板布局、功能和内容由 TUTOR-01/tutor_panel 契约决定，空容器不提前实现它们。

从现有入口打开 /tutor 时，push 的 history state 只保存可序列化的背景 location（路径、query、hash）和 overlayKey；触发 HTMLElement 引用仅保存在当前应用内存 Map<overlayKey,HTMLElement>，不放进 history state。刷新或缺少同生命周期记录时按冷启动处理。模态期间背景挂载且不可交互；dialog.showModal() 约束 Tab/Shift+Tab，提供可读标题。关闭和 Esc 阻止原生无路由关闭，统一执行 back；浏览器后退关闭覆盖，前进可重新打开。同一次覆盖只产生一次关闭导航；不把按钮关闭和 dialog 的关闭通知各执行一遍。

冷启动或刷新 /tutor 没有有效背景记录时，先用 React Router 的 replace 导航到 /today，待背景位置建立后只执行一次 push 到 /tutor，再标记 ready；规范化过程不发启动事件。于是后退落到 /today，前进重新打开；不调用 back 猜测外部历史。背景视图的登记 mode 必须允许导师，否则归同一冷深链路径。外部可伪造的 history state 不作为页面登记或权限来源。

关闭后焦点回到仍连接、可见且可聚焦的触发元素；深链或原元素不可用时，移到落点页的主标题（tabIndex=-1），避免焦点丢到文档开头。

手机菜单为根内的原生 dialog 左侧抽屉，顶/底贴可用视口，宽度取 size.shell.drawer 与可用外壳宽度的较小值，高度不超过可用视口；留白/层级只用登记令牌。只在手机档且 standard/guided 时显示打开按钮及允许打开；immersive 连同按钮一起隐藏，standalone 无页头。菜单不 push/replace 历史；关闭按钮/Esc 只关闭并归还焦点，浏览器后退按原历史正常导航、不阻止 popstate。任何 location 变化（含 query/hash）、离开手机档或切到不允许导航的 mode 都关闭菜单，路由导航后焦点交给落点页规则。点入口先关闭再执行普通路由导航；同路由入口仅关闭。开启导师前先关闭菜单，外壳同时只保留一个模态容器。

浅/深色使用应用根内存状态，单一最外层 [data-ep-shell] 的 data-scheme 为权威值；演示中的切换控件更新该状态，内嵌演示外壳和所有 dialog 继承，不自行覆盖。切到五入口或返回演示仍保留本次状态，刷新恢复 light；不增加正式外观设置。Playwright 以 addInitScript 在挂载前设 window.__EXAM_PREP_INITIAL_SCHEME__ 为 light/dark；bootstrap 仅在 development/test/staging 读取一次并初始化内存状态，未知值按 light，production 忽略此测试入口。挂载后只通过演示控件更新同一状态，不单独改 DOM 属性。截图矩阵依 PLAT-01-AC5，/tutor 先完成深链规范化再截图。

## 输入类型与统一错误

apps/learner 通过 resolveJsonModule 导入 zh-CN.json，以 type MessageKey=keyof typeof zhCN 取得本地键联合。ui 不导入该应用资源/类型；下列 K 是 factory 绑定的键参数，调用方插值只接受字符串/有限数字。ErrorCode 与 ERROR_MESSAGE_KEYS 由 0.1b 从 contracts/errors.yaml 生成到 packages/contract/generated/errors.generated.ts，独立于 Orval 的 Error.code:string；映射包含登记 code→message_key。Clock 单位为 epoch 毫秒。

```ts
type Params = Readonly<Record<string, string | number>>;
type Message<K extends string> = Readonly<{ key: K; params?: Params }>;
type Clock = Readonly<{
  now(): number;
  subscribe(tick: () => void): () => void;
}>;
type Scope = 'page' | 'block';
type Base = Readonly<{ pageKey: string }>;
type Content =
  | Readonly<{ hasContent: true; children: ReactNode }>
  | Readonly<{ hasContent: false; children?: never }>;
type Action<K extends string> = Readonly<{ label: Message<K>; run: () => Promise<void> }>;
type Explanation<K extends string> = Readonly<{ message: Message<K>; action: Action<K> }>;
type Failure = Readonly<{ code: ErrorCode }>;
type Report = Readonly<{ pageKey: string; errorCode: ErrorCode }>;
type StateViewProps<K extends string> = Base & (
  | { state: 'normal'; scope: Scope; children: ReactNode }
  | (Content & { state: 'loading'; scope: Scope;
      slowHintSeconds: number; clock: Clock })
  | (Content & Explanation<K> & { state: 'empty'; scope: Scope })
  | (Content & { state: 'error'; scope: Scope; errorCode: ErrorCode;
      onRetry(): Promise<void>; onReport(report: Report): void })
  | (Content & { state: 'offline'; scope: Scope;
      availableFeatureKeys: readonly K[] })
  | (Content & Explanation<K> & { state: 'restricted'; scope: Scope })
  | (Content & Explanation<K> & { state: 'insufficient_data'; scope: Scope })
  | (Content & Explanation<K> & { state: 'locked'; scope: 'block' })
);
type ProposalCardProps<K extends string> = Readonly<{
  source: 'planner' | 'demo';
  change: Message<K>; reason: Message<K>; cost: Message<K>; unchanged: Message<K>;
  onConfirm(): Promise<void>;
  onDecline(): Promise<void>;
}>;
type UndoBarProps = Readonly<{
  deadline: string;
  clock: Clock;
  onUndo(): Promise<void>;
}>;
declare function createUi<K extends string>(): Readonly<{
  UiProvider: ComponentType<{
    t: (key: K, params?: Params) => string;
    children: ReactNode;
  }>;
  StateView: ComponentType<StateViewProps<K>>;
  ProposalCard: ComponentType<ProposalCardProps<K>>;
  UndoBar: ComponentType<UndoBarProps>;
  ShellPage: ComponentType<ShellPageProps<K>>;
}>;
```

应用唯一入口在 React 挂载前调用一次 createUi<MessageKey>() 并导出返回的 UiProvider/组件，页面只用这些已绑定组件，不直接实例化宽泛 string 组件。UiProvider 注入应用的 t；factory 返回组件的 K 已固定，调用方键由组件 props 检查，不依靠 React Context 把父 Provider 的类型传播给任意 children。内置文案键由 UI 实现的已登记键表验证资源存在；0.1b 和功能测试须对照中文资源检查全部内置键及错误映射键，缺失不能静默展示键名。

TypeScript 在编译期检查必填字段、基本类型、枚举和联合约束；跨 JS 边界还做运行时形状检查。有限值和取值条件由运行时检查：slowHintSeconds 须非负且有限，Clock.now() 须有限，数字插值须有限。缺字段、错误类型、locked/page、非法步骤统一只渲染 ui.input.invalid（组件输入无效），不渲染传入 children 或动作、不抛出到应用根。有效 StateView 转态或切换 scope 时，hasContent=true 的 children 始终在同一个内容槽位与 React key 下，不克隆或重建。StateView 不禁用任意后代；调用方按自身规则禁用内容动作，组件仅管理自己提供的动作。

scope 不改变组件内部树、骨架种类或提示排列，只改变固定外容器的区域/宽度样式。page 由调用方放在现有 main 的主内容层、占用该层可用宽度；block 放在所属业务区块内并受该块宽度约束。两者使用同一个 section 外容器且不另建 main、不自动加页标题；不由组件 reparent 到其他节点或 portal。提示与内容的固定顺序如下，切换 scope 只更新外容器属性，不能重挂 children。

|state|page/block 共用的内部结构|提示语义|
|---|---|---|
|normal|仅固定内容槽|无新增角色|
|loading|无内容为同形骨架；有内容为忙碌提示后接内容槽|status，容器 aria-busy|
|empty|原因/动作提示后接可选内容槽|status|
|error|错误/重试提示后接可选内容槽|alert|
|offline|可用功能提示后接可选内容槽|status|
|restricted|原因/动作提示后接可选内容槽|alert|
|insufficient_data|缺口/动作提示后接可选内容槽|status|
|locked|仅 block：锁定/动作提示后接可选内容槽|status；page 为非法输入|

R4 的“横幅/区块提示”指上述同一个提示槽在所属区域内呈现，不暗示 scope 改变内部结构。骨架不复制业务页面布局；没有传入内容时组件只呈现通用状态内容。

两个有意定义的异常使用专用表现：ProposalCard 的 ai/未知 source 显示 ui.proposal.unsupported_source，隐藏正文与动作；UndoBar 的 deadline 格式错误显示 ui.undo.invalid_deadline 且禁用撤销。deadline 复用共同前置事件时间的 RFC 3339 子集判定口径：大写 T/Z、必须有秒、可选 1–3 位小数、Z 或 ±HH:MM，并验证日历日期和时区偏移；拒绝省秒、基本格式、逗号小数、±HHMM、-00:00、闰秒、超过毫秒精度、无时区及溢出日期，不截断或纠正。其余非法输入仍用统一表现。

动作 Promise pending 时禁用本组件全部动作，避免确认与不改并发；resolve 后由调用方更新状态，组件不提前执行学员状态变更。reject 值仅在 typeof 为 object、非 null、具有自有 code 属性，且读取所得为 ERROR_MESSAGE_KEYS 自有成员的字符串时按该登记码映射；带自有 code 的 Error 也接受，继承 code、未知码、非对象及取属性抛错均为 COMMON_UNAVAILABLE。UI 不窥探 Orval 的 response/data 等响应结构；业务适配器先把已识别的领域错误转成 Failure。断网/超时/响应解析失败也适配为 COMMON_UNAVAILABLE，不显示原始异常。

reject 后保留内容、恢复动作，并立即用本次映射键显示本地失败。StateView 以本地失败码优先于 props.errorCode；state/pageKey/errorCode 任一变化即清除本地失败，回到新 props 的表现，普通重渲染不清除。ProposalCard 的 source 或四项 Message 的 key/params 内容变化、UndoBar 的 deadline 变化、其他状态提示的 state/pageKey/message 内容变化同样清除各自本地失败；只变回调/Clock 引用不视为换输入。新尝试开始清除上次动作失败，输入变化/卸载使旧尝试不能再写本地错误或解锁新尝试。StateView 每次实际 retry reject 上报一次，使用该次 pageKey 和映射码；首次 props 错误由调用方上报。onReport 抛错由边界吞并且不递归上报；0.1（含预发）调用方只注入 Report 结构化桩。

Clock 的默认适配器每秒及页面回到前台通知，替身可推进；subscribe 只建立一次，卸载/退出 loading 时取消。进入 loading 即计时；slowHintSeconds 变化按同一次 loading 已经过时长重新判断。UndoBar 同用 Clock：remaining=max(0,deadline-now)，正值取天/小时/分/秒中达到的最大单位向上取整；不足一秒仍显示 ui.undo.remaining_seconds 的 count=1，到零显示 ui.undo.expired。无效 deadline 不显示倒计时。真实是否可撤销仍由回调的服务端结果决定。

固定演示时间/数字只存在 apps/learner/src/demo/*.fixture.ts 或 tests/fixtures/**，由共同前置规定的路径排除扫描，不在生产代码添加夹具豁免。param-exempt 同行注释仅用于单位换算或 HTTP/格式协议常量；业务阈值始终由登记读取。

offline 的列表逐项显示“可用”功能文字；空数组显示 ui.state.offline_none，不自行推定离线业务能力。empty/restricted/insufficient_data/locked 都由调用方提供可理解的原因与一个下一步动作；缺口数字仅作插值，组件不计算指标。action.run 的失败与其他动作使用同一映射规则。

## 中文键空间

中文资源使用 nav.*、ui.shell.*、ui.placeholder.*、ui.input.*、ui.state.*、ui.proposal.*、ui.undo.*、demo.platform.*、error.*。ui.shell.app_name 为“备考助手”，open_menu/close_menu/close_tutor 分别为“打开菜单”“关闭菜单”“关闭导师”；not_found/route_not_found/back_today 分别为“页面不存在”“找不到这个页面”“返回今日”。占位文案 ui.placeholder.not_open 为“尚未开放”；当前页头来自登记 title，不另存中文副本。

其余通用文案由实现者按语义提供中文并完成键类型检查：无效输入、骨架/加载中/仍在加载、错误/重试、离线可用列表/无可用功能、提议四项标题/确认/不改/不支持来源、撤销/无效截止时间/已到期/按单位剩余时间和“演示”标签。页面原因及可用功能键由页面调用方维护；error.* 的中文遵循 errors.yaml 登记，COMMON_UNAVAILABLE 包括网络故障，不能用未登记前端码代替。
