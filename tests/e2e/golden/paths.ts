// 黄金路径（docs/baseline/golden-paths.md，6 条）：每条路径的步骤（到哪一页、在那一页做什么）与阶段 2 要补的断言。
// 阶段 1（F06）只走页面跳转：逐步直接打开每一步的页面，核对能打开、没有报错。
// 接后端后补断言（任务 B21）：把逐步打开换成在上一页真实点击 action 里的按钮，并把 later 里的断言写成检查。
// 规则卡定稿后本目录锁定，只有规则卡任务能改（AGENTS.md「测试与修 bug」）。

/** 每条路径都用演示考试 kj（初级会计）走，手机 375 与桌面 1280 各一遍。 */
export const GOLDEN_EXAM = "kj";
export const GOLDEN_VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
] as const;

export interface GoldenStep {
  /** 页 ID（路径取路由表）。 */
  readonly page: string;
  /** ?view= 视图；不写就是默认视图。 */
  readonly view?: string;
  /** 在这一页上做的事；阶段 1 只记下来，接后端后改成真实操作。 */
  readonly action: string;
}

export interface GoldenPath {
  readonly id: string;
  readonly title: string;
  readonly steps: readonly GoldenStep[];
  /** 阶段 2 的断言（接后端后补断言）。 */
  readonly later: readonly string[];
}

export const GOLDEN_PATHS: readonly GoldenPath[] = [
  {
    id: "G1",
    title: "首次使用",
    steps: [
      { page: "S01", view: "first", action: "选年龄段，点“先体验，不注册”" },
      { page: "S02", view: "first", action: "选“初级会计职称”" },
      { page: "S03", view: "time", action: "只填“每天学多久”" },
      { page: "S04", view: "start", action: "选“快速定位”（按章自评为主、少量题为辅）" },
      { page: "S04", view: "test", action: "做完快速定位" },
      { page: "S05", view: "quick", action: "看起点报告，在稳妥、标准、冲刺里选“标准”，点“生成我的计划”（此处要求登录）" },
      // 登录在 S01 欢迎与登录（登录为独立页）：阶段 1 用直接出登录表单的 back 视图代表，接后端后按真实跳转改
      { page: "S01", view: "back", action: "登录" },
      { page: "S06", view: "first", action: "进入今日（首次进入视图）" },
    ],
    later: ["游客数据并入正式账号", "今日清单有三段", "三个数有值或显示“数据不足”（首日不显示“较上周”）"],
  },
  {
    id: "G2",
    title: "一天",
    steps: [
      { page: "S06", action: "巩固段点“到期复习”" },
      { page: "S15", view: "session", action: "复习会话：翻面、评分" },
      { page: "S06", action: "回到今日，该项显示已完成；点“错题回炉”" },
      { page: "S18", view: "obj", action: "做题" },
      { page: "S06", action: "回到今日，推进段点“新学”" },
      { page: "S12", action: "阅读，读后即测" },
      { page: "S06", view: "done", action: "今日“全部完成”视图" },
    ],
    later: ["完成判定只认证据", "实际用时被记录", "全部完成后明天清单可预览"],
  },
  {
    id: "G3",
    title: "做题到地图变色",
    steps: [
      { page: "S17", action: "开始一组练习" },
      { page: "S18", view: "obj", action: "作答、选把握度、提交、看分层揭晓" },
      { page: "S10", action: "知识点主页“我的证据”出现这次作答" },
      { page: "S09", action: "方格颜色更新" },
    ],
    later: ["蒙对不升档、进“待验证”", "证据不足的格子画虚线，与“未学”分开", "档位依据可展开查看"],
  },
  {
    id: "G4",
    title: "错题闭环",
    steps: [
      { page: "S18", view: "obj", action: "做错一题" },
      { page: "S19", action: "错题本出现这道题（新增），确认错因" },
      { page: "S06", action: "时间推进到到期日（?now=）后，巩固段出现“错题回炉”" },
      // 毕业条件默认是间隔做对 2 次、再做对 1 道变式题；数字来自参数，接后端后从参数读，不写死
      { page: "S18", view: "obj", action: "按回炉间隔逐次做对，直到满足毕业条件" },
      { page: "S19", action: "错题显示已毕业" },
    ],
    later: ["四个状态按规则卡 R03 流转", "毕业条件可配置"],
  },
  {
    id: "G5",
    title: "模考到计划",
    steps: [
      { page: "S22", view: "home", action: "模考中心：选一场模考" },
      { page: "S22", view: "confirm", action: "开考确认" },
      { page: "S22", view: "exam", action: "作答（导师与搜索暂停），交卷" },
      { page: "S23", action: "测评报告：点“补强清单加入计划”" },
      { page: "S07", action: "学习计划出现待确认提议，确认" },
      { page: "S06", action: "确认后今日清单变化" },
    ],
    later: ["计时以服务器为准", "断点续考答案不丢", "提议确认前计划不变"],
  },
  {
    id: "G6",
    title: "问导师",
    steps: [
      { page: "S18", view: "obj", action: "揭晓后点“讲解与追问”" },
      { page: "S28", view: "normal", action: "导师回答带出处与“AI 生成”标识；点“生成卡片”" },
      { page: "S15", view: "home", action: "卡片进待确认区，收下" },
      { page: "S15", view: "session", action: "收下的卡片进入复习队列" },
    ],
    later: ["导师不能直接改计划与卡片", "导师不可用时 S06、S15 照常可用"],
  },
];
