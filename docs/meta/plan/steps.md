# 总步骤表

> 由 phases.yaml、roadmap.yaml 与实施表生成。一行一步，按顺序做；“流程”列见 README 第 3 节。这里不打勾，进度以仓库状态为准（README 第 2 节）。

| 步 | 做什么 | 流程 | 谁 | 你要做的 | 完成判据 | 详见 |
|---|---|---|---|---|---|---|
| B0-1 | 应用补丁 v3 第 1 次提交：编号基线标记与页面深化暂缓（ADR-023） | — | Codex | 无 | ID_BASELINE 为 v1.0；check 0 错误；coverage 961/961 且没有待深化页 | [B0.md](B0.md) |
| B0-2 | 应用补丁 v3 第 2、3 次提交：技术栈基线（ADR-025 至 ADR-029）；实施总纲、交接工具与 drive 技能（ADR-024） | — | Codex | 无 | gen --check、check、budget 通过；handoff.py selftest 通过 | [B0.md](B0.md) |
| B0-3 | 搭网页版 Claude 项目，做一次握手测试 | — | 你 ＋ Codex | 建项目、粘贴说明、传一个测试包、下载结果 | handoff.py in --dry-run 校验通过；docs/product/calibration.yaml 有 handshake_ok | [B0.md](B0.md) |
| B0-4 | 拍板决策单（种子考试、内容来源、参数默认值、微信绑手机号、知识类型副类型、路线变体） | — | 你 | 逐条回复“按默认”或改 | OQ-001、007、008、010、012 为 resolved；docs/product/calibration.yaml 有路线变体的 decision | [B0.md](B0.md) |
| B0-5 | 启动场外三条轨道（合规与备案、内容授权、受邀用户） | — | 你 | 找负责人、定日期 | 归档 ops/ 下的台账有负责人与日期；docs/product/calibration.yaml 有 tracks_started | [B0.md](B0.md) |
| P0-入 | 第 0 期期初检查：地基与探针 | P7 | Codex ＋ 你 | 确认外部事项 | 进入条件逐条有证据 | [phase-0.md](phase-0.md) |
| 0.1-S | 写并复核本闭环 3 份规格：PLAT-01、PLAT-02、METR-01（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/0.1.md](loops/0.1.md) |
| 0.1-T | 0.1b 按 ADR-025 至 ADR-029 接线：五个应用骨架、docker compose、CI 运行 verify、阿里云预发自动部署与回滚 | 见下文 | Codex | 开通阿里云与 GitHub 账号，按 Codex 的清单填写环境变量与密钥（不进仓库） | 见闭环文件“闭环级任务”与 work/0.1b.md；完成前不出功能实现包 | [loops/0.1.md](loops/0.1.md) |
| 0.1-2 | 实现 PLAT-02 参数注册与运行时访问器 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/0.1.md](loops/0.1.md) |
| 0.1-3 | 实现 METR-01 埋点事件表与有效学习口径 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/0.1.md](loops/0.1.md) |
| 0.1-1 | 实现 PLAT-01 学员端外壳与通用状态组件 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/0.1.md](loops/0.1.md) |
| 0.1-T | 0.1a 仓库、目录约定与项目记忆：由文档体系承担（ADR-008） | 见下文 | Codex | 无 | 见闭环文件“闭环级任务” | [loops/0.1.md](loops/0.1.md) |
| 0.1-C | 收尾：本闭环测试全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/0.1.md](loops/0.1.md) |
| 0.2-S | 写并复核本闭环 5 份规格：EXM-01、MAP-01、CONT-01、LRN-01、CONT-02（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/0.2.md](loops/0.2.md) |
| 0.2-1 | 实现 EXM-01 考试画像结构与评价规则 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/0.2.md](loops/0.2.md) |
| 0.2-2 | 实现 MAP-01 知识地图模型：稳定 ID、版本与扩展层 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/0.2.md](loops/0.2.md) |
| 0.2-3 | 实现 CONT-01 题目模型：作答形态与四级可信度 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/0.2.md](loops/0.2.md) |
| 0.2-4 | 实现 LRN-01 证据账本与掌握档派生 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/0.2.md](loops/0.2.md) |
| 0.2-5 | 实现 CONT-02 种子导入器与主考试、对照考试种子 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/0.2.md](loops/0.2.md) |
| 0.2-T | 0.2d 统一词汇常量：以 docs/product/glossary.yaml 的 values 为源，随 LRN-01 落地 | 见下文 | Codex | 无 | 见闭环文件“闭环级任务” | [loops/0.2.md](loops/0.2.md) |
| 0.2-T | 0.2f 预留字段：数据类别、租户、游客身份随各表结构落地，写迁移与约束测试 | 见下文 | Codex | 无 | 见闭环文件“闭环级任务” | [loops/0.2.md](loops/0.2.md) |
| 0.2-T | 0.2 一向门：核对实现与 ADR-005、ADR-006、ADR-009 至 ADR-016、ADR-028 一致 | 见下文 | Codex | 无 | 见闭环文件“闭环级任务” | [loops/0.2.md](loops/0.2.md) |
| 0.2-C | 收尾：本闭环测试全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/0.2.md](loops/0.2.md) |
| 0.3-S | 写并复核本闭环 1 份规格：PRAC-01（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/0.3.md](loops/0.3.md) |
| 0.3-1 | 实现 PRAC-01 行走骨架：知识点页做一题到方格变色 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/0.3.md](loops/0.3.md) |
| 0.3-C | 收尾：GP-0 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/0.3.md](loops/0.3.md) |
| 0.4-T | 0.4A 探针 A：证据→档位规则表，结论写入 OQ-002 | 见下文 | Codex | 读探针结论，拍板继续、收缩或换方向 | 见闭环文件“闭环级任务” | [loops/0.4.md](loops/0.4.md) |
| 0.4-T | 0.4B 探针 B：记忆调度选型，结论写入 OQ-003 | 见下文 | Codex | 读探针结论，拍板继续、收缩或换方向 | 见闭环文件“闭环级任务” | [loops/0.4.md](loops/0.4.md) |
| 0.4-T | 0.4C 探针 C：AI 解析质量，结论写入 OQ-004 | 见下文 | Codex | 读探针结论，拍板继续、收缩或换方向 | 见闭环文件“闭环级任务” | [loops/0.4.md](loops/0.4.md) |
| 0.4-T | 0.4D 探针 D：排程启发式，结论写入 OQ-005 | 见下文 | Codex | 读探针结论，拍板继续、收缩或换方向 | 见闭环文件“闭环级任务” | [loops/0.4.md](loops/0.4.md) |
| 0.4-C | 收尾：四个探针的结论记入 OQ-002 至 OQ-005、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/0.4.md](loops/0.4.md) |
| P0-出 | 第 0 期期末：发布、观测、复盘、滚动细化下一期 | P7 | Codex ＋ 你 | 发布给受众环、看指标、确认下一期 | 出口标准逐条有证据 | [phase-0.md](phase-0.md) |
| P1-入 | 第 1 期期初检查：核心日循环 | P7 | Codex ＋ 你 | 确认外部事项 | 进入条件逐条有证据 | [phase-1.md](phase-1.md) |
| P1-TR | 并行事项：启动合规轨：长交期外部事项 | — | 你 | 找专业顾问或主管部门确认最新要求，然后启动：生成式人工智能服务相关的备案或登记、隐私政策与用户协议文本、支付商户与应用内 | 台账里每一项都有负责人、预计周期与当前状态；目标是 4 期开工前全部到位。 | [phase-1.md](phase-1.md) |
| P1-TR | 并行事项：招募受邀用户，准备访谈 | — | 你 | 招 5–20 位考同一种子考试的考生，优先考期能被 3 期覆盖的人（3 期要跨越一个真实考期）；建一个联系群；约好 1  | 有一份受邀名单与各自的考试日期；访谈提纲定稿。 | [phase-1.md](phase-1.md) |
| 1.1-S | 写并复核本闭环 4 份规格：PRAC-02、LRN-02、MAP-02、PRAC-03（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/1.1.md](loops/1.1.md) |
| 1.1-1 | 实现 PRAC-02 作答流程、把握度与分层揭晓 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.1.md](loops/1.1.md) |
| 1.1-2 | 实现 LRN-02 证据入账、档位依据与待验证 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.1.md](loops/1.1.md) |
| 1.1-3 | 实现 MAP-02 方格全景与知识点主页最小版 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.1.md](loops/1.1.md) |
| 1.1-4 | 实现 PRAC-03 练习入口、纸笔动作、小结与记录 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.1.md](loops/1.1.md) |
| 1.1-C | 收尾：GP-1 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/1.1.md](loops/1.1.md) |
| P1-CAL | 校准：第一次校准：用 1.1 的实测重算全部预算 | — | Codex | 确认 Codex 从交接记录统计的 1.1 实际轮次与功能数。 | docs/product/calibration.yaml有 1.1 的一行；后续闭环的预算已按系数调整。 | [phase-1.md](phase-1.md) |
| 1.2-S | 写并复核本闭环 2 份规格：PLAN-01、PLAN-02（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/1.2.md](loops/1.2.md) |
| 1.2-1 | 实现 PLAN-01 最小建档与任务生成器 v0 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.2.md](loops/1.2.md) |
| 1.2-2 | 实现 PLAN-02 今日页骨架、串联、完成判定与夜间顺延 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.2.md](loops/1.2.md) |
| 1.2-C | 收尾：GP-2 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/1.2.md](loops/1.2.md) |
| 1.3-S | 写并复核本闭环 4 份规格：PRAC-04、PLAN-03、PRAC-05、PRAC-06（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/1.3.md](loops/1.3.md) |
| 1.3-1 | 实现 PRAC-04 错题自动收录与错因确认 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.3.md](loops/1.3.md) |
| 1.3-2 | 实现 PLAN-03 到期队列接口与今日巩固段 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.3.md](loops/1.3.md) |
| 1.3-3 | 实现 PRAC-05 错题间隔回炉与毕业 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.3.md](loops/1.3.md) |
| 1.3-4 | 实现 PRAC-06 错题本页 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.3.md](loops/1.3.md) |
| 1.3-C | 收尾：GP-3 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/1.3.md](loops/1.3.md) |
| 1.4-S | 写并复核本闭环 4 份规格：LRN-03、PRAC-07、PRAC-08、PLAN-04（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/1.4.md](loops/1.4.md) |
| 1.4-1 | 实现 LRN-03 记忆状态与目标日感知调度 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.4.md](loops/1.4.md) |
| 1.4-2 | 实现 PRAC-07 知识点回忆卡与复习会话 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.4.md](loops/1.4.md) |
| 1.4-3 | 实现 PRAC-08 手动制卡、待确认区与溯源 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.4.md](loops/1.4.md) |
| 1.4-4 | 实现 PLAN-04 每日复习上限、积压保护与统一排序 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.4.md](loops/1.4.md) |
| 1.4-C | 收尾：GP-4 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/1.4.md](loops/1.4.md) |
| 1.5-S | 写并复核本闭环 4 份规格：LRN-04、PLAN-05、PLAN-06、PLAN-07（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/1.5.md](loops/1.5.md) |
| 1.5-1 | 实现 LRN-04 快速定位 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.5.md](loops/1.5.md) |
| 1.5-2 | 实现 PLAN-05 掌握方格、时间可行性与轮次路线 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.5.md](loops/1.5.md) |
| 1.5-3 | 实现 PLAN-06 学习范围三态、周分配与缓冲顺延 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.5.md](loops/1.5.md) |
| 1.5-4 | 实现 PLAN-07 提议卡、重排记录与计划三层视图 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.5.md](loops/1.5.md) |
| 1.5-C | 收尾：GP-5 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/1.5.md](loops/1.5.md) |
| 1.6-S | 写并复核本闭环 4 份规格：ACCT-01、PLAN-08、COMP-01、SUPP-01（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/1.6.md](loops/1.6.md) |
| 1.6-1 | 实现 ACCT-01 手机号登录、协议同意与老用户直达 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.6.md](loops/1.6.md) |
| 1.6-2 | 实现 PLAN-08 断连恢复与今天不可学 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.6.md](loops/1.6.md) |
| 1.6-3 | 实现 COMP-01 学习数据导出 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.6.md](loops/1.6.md) |
| 1.6-4 | 实现 SUPP-01 题目报错与帮助反馈入口 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/1.6.md](loops/1.6.md) |
| 1.6-T | 1.6e 受邀上线检查：多端走查、七态检查、备份恢复演练、北极星数据核对 | 见下文 | Codex | 视任务 | 见闭环文件“闭环级任务” | [loops/1.6.md](loops/1.6.md) |
| 1.6-T | 1.6e 受邀上线检查 | 见下文 | Codex | 亲手走一遍一句话演示 | 见闭环文件“闭环级任务” | [loops/1.6.md](loops/1.6.md) |
| 1.6-C | 收尾：GP-6 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/1.6.md](loops/1.6.md) |
| P1-G | 受众环门槛：受众环 ring-1 门槛：可以邀请 5–20 人 | — | 你 | 逐项确认门槛都已满足，缺一项就不扩大受众：不提前做（拖慢核心验证），也不拖后（挡住扩大受众）。 | 门槛清单全部满足：手机号登录与协议同意（1.6a）；数据导出（1.6d）；报错与反馈通道（1.6d）；备份恢复演练（1.6e）。 | [phase-1.md](phase-1.md) |
| P1-出 | 第 1 期期末：发布、观测、复盘、滚动细化下一期 | P7 | Codex ＋ 你 | 发布给受众环、看指标、确认下一期 | 出口标准逐条有证据 | [phase-1.md](phase-1.md) |
| P2-入 | 第 2 期期初检查：自助入门与“学”的闭环 | P7 | Codex ＋ 你 | 确认外部事项 | 进入条件逐条有证据 | [phase-2.md](phase-2.md) |
| P2-TR | 并行事项：确认种子教材文本的使用权 | — | 你 | 确认阅读器要用的文本都有使用权：自编讲义、官方公开的大纲与规范、已获授权的电子教材。拿不到授权就先用自编讲义。 | 种子教材文本的使用权状态为“已确认”（2 期进入条件）。 | [phase-2.md](phase-2.md) |
| P2-TR | 并行事项：安排危机信号的人工接手 | — | 你 | 导师上线前必须有人接手危机信号：设置风险信号实时通知到你的手机；准备核验过的求助信息（热线号码亲自打一遍核对）；约定收到 | 值守手册写好；你能在测试环境收到一条模拟的风险信号通知（2 期进入条件）。 | [phase-2.md](phase-2.md) |
| 2.1-S | 写并复核本闭环 4 份规格：ACCT-02、PLAN-09、EXM-02、ACCT-03（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/2.1.md](loops/2.1.md) |
| 2.1-1 | 实现 ACCT-02 欢迎页两态、游客先体验与登录后合并 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.1.md](loops/2.1.md) |
| 2.1-2 | 实现 PLAN-09 引导流步骤条与周时间格 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.1.md](loops/2.1.md) |
| 2.1-3 | 实现 EXM-02 确认画像面板与目标页两态 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.1.md](loops/2.1.md) |
| 2.1-4 | 实现 ACCT-03 登录时机、新手引导与上手清单 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.1.md](loops/2.1.md) |
| 2.1-C | 收尾：GP-7 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/2.1.md](loops/2.1.md) |
| 2.2-S | 写并复核本闭环 3 份规格：LRN-05、LRN-06、LRN-07（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/2.2.md](loops/2.2.md) |
| 2.2-1 | 实现 LRN-05 摸底开始页、测评态与沉浸界面 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.2.md](loops/2.2.md) |
| 2.2-2 | 实现 LRN-06 自适应选题与分模块估计 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.2.md](loops/2.2.md) |
| 2.2-3 | 实现 LRN-07 断点续做、只升不降与诊断错题去向 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.2.md](loops/2.2.md) |
| 2.2-C | 收尾：GP-8 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/2.2.md](loops/2.2.md) |
| 2.3-S | 写并复核本闭环 2 份规格：LRN-08、PLAN-10（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/2.3.md](loops/2.3.md) |
| 2.3-1 | 实现 LRN-08 预测 v0：区间、差额与差距归因 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.3.md](loops/2.3.md) |
| 2.3-2 | 实现 PLAN-10 三档方案、边际收益与轮次草案 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.3.md](loops/2.3.md) |
| 2.3-C | 收尾：GP-9 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/2.3.md](loops/2.3.md) |
| 2.4-S | 写并复核本闭环 3 份规格：CONT-03、CONT-04、CONT-05（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/2.4.md](loops/2.4.md) |
| 2.4-1 | 实现 CONT-03 阅读器与考点标注层 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.4.md](loops/2.4.md) |
| 2.4-2 | 实现 CONT-04 标注、阅读模式与读后即测 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.4.md](loops/2.4.md) |
| 2.4-3 | 实现 CONT-05 有效阅读计时、双进度与资料定位 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.4.md](loops/2.4.md) |
| 2.4-C | 收尾：GP-10 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/2.4.md](loops/2.4.md) |
| 2.5-S | 写并复核本闭环 4 份规格：CONT-06、CONT-07、CONT-08、MAP-03（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/2.5.md](loops/2.5.md) |
| 2.5-1 | 实现 CONT-06 划选工具条与侧栏笔记 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.5.md](loops/2.5.md) |
| 2.5-2 | 实现 CONT-07 笔记归位、知识点主页三板块与转卡转题 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.5.md](loops/2.5.md) |
| 2.5-3 | 实现 CONT-08 笔记本页 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.5.md](loops/2.5.md) |
| 2.5-4 | 实现 MAP-03 知识点建议学法与自评检验 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.5.md](loops/2.5.md) |
| 2.5-C | 收尾：GP-11 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/2.5.md](loops/2.5.md) |
| 2.6-S | 写并复核本闭环 5 份规格：AIGOV-01、TUTOR-01、TUTOR-02、TUTOR-03、TUTOR-04（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/2.6.md](loops/2.6.md) |
| 2.6-1 | 实现 AIGOV-01 AI 网关：调用、降级、标识与计量 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.6.md](loops/2.6.md) |
| 2.6-2 | 实现 TUTOR-01 讲一下：带上下文、学情与出处的讲解 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.6.md](loops/2.6.md) |
| 2.6-3 | 实现 TUTOR-02 追问五键与讲法切换 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.6.md](loops/2.6.md) |
| 2.6-4 | 实现 TUTOR-03 导师边界、拒答与危机处置 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.6.md](loops/2.6.md) |
| 2.6-5 | 实现 TUTOR-04 导师写操作走待确认与回答反馈 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/2.6.md](loops/2.6.md) |
| 2.6-C | 收尾：GP-12 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/2.6.md](loops/2.6.md) |
| P2-G | 受众环门槛：受众环 ring-1+ 门槛：可以扩大到 30–100 人 | — | 你 | 逐项确认门槛都已满足，缺一项就不扩大受众：不提前做（拖慢核心验证），也不拖后（挡住扩大受众）。 | 门槛清单全部满足：无人协助的入门（2.1）；导师的危机处置与生成标识（2.6）；值守安排（2 期值守）。 | [phase-2.md](phase-2.md) |
| P2-出 | 第 2 期期末：发布、观测、复盘、滚动细化下一期 | P7 | Codex ＋ 你 | 发布给受众环、看指标、确认下一期 | 出口标准逐条有证据 | [phase-2.md](phase-2.md) |
| P2-D | 决策点：选路线：默认 A，还是 C（尽早公开或收费）、D（自建先行） | — | 你 | 看商业判断选一条路线；不论选哪个，三条不变：0、1 期不动；安全随行不打折；闭环与切片的尺寸标准不变。 | 写成 ADR（Codex 在主干用 new adr 分配编号）；如选 C 或 D，步骤表后续顺序按下面的说明调整。 | [phase-2.md](phase-2.md) |
| P3-入 | 第 3 期期初检查：测评、预测与考期收尾 | P7 | Codex ＋ 你 | 确认外部事项 | 进入条件逐条有证据 | [phase-3.md](phase-3.md) |
| P3-TR | 并行事项：整理考情数据 | — | 你 | 为种子考试整理考情数据：各知识点的分值、考察概率与出处（往年真题统计）。拿不到的就留空，3.2d 会按“无考情降级”处理 | 考情数据进了种子，或明确标注“暂无”。 | [phase-3.md](phase-3.md) |
| 3.1-S | 写并复核本闭环 4 份规格：PRAC-09、PRAC-10、PRAC-11、PLAN-11（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/3.1.md](loops/3.1.md) |
| 3.1-1 | 实现 PRAC-09 组卷、开考确认与严格计时 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.1.md](loops/3.1.md) |
| 3.1-2 | 实现 PRAC-10 过程记录、断点续考与试卷快照 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.1.md](loops/3.1.md) |
| 3.1-3 | 实现 PRAC-11 测评报告：成绩、失分归因与分析 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.1.md](loops/3.1.md) |
| 3.1-4 | 实现 PLAN-11 补强清单以提议加入计划 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.1.md](loops/3.1.md) |
| 3.1-C | 收尾：GP-13 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/3.1.md](loops/3.1.md) |
| 3.2-S | 写并复核本闭环 4 份规格：METR-02、LRN-09、LRN-10、METR-03（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/3.2.md](loops/3.2.md) |
| 3.2-1 | 实现 METR-02 完成度与健康度口径 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.2.md](loops/3.2.md) |
| 3.2-2 | 实现 LRN-09 预测 v1：融合模考的三值与各科对比 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.2.md](loops/3.2.md) |
| 3.2-3 | 实现 LRN-10 性价比阶梯、推荐路径与无考情降级 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.2.md](loops/3.2.md) |
| 3.2-4 | 实现 METR-03 三个数常驻、有效学习时长与学情导出 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.2.md](loops/3.2.md) |
| 3.2-C | 收尾：GP-14 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/3.2.md](loops/3.2.md) |
| 3.3-S | 写并复核本闭环 3 份规格：PLAN-12、PLAN-13、PLAN-14（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/3.3.md](loops/3.3.md) |
| 3.3-1 | 实现 PLAN-12 固定结构周报与只改一件事 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.3.md](loops/3.3.md) |
| 3.3-2 | 实现 PLAN-13 声明与实测校准、压缩与放弃 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.3.md](loops/3.3.md) |
| 3.3-3 | 实现 PLAN-14 请假与忙季、轮次总结与报告反馈 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.3.md](loops/3.3.md) |
| 3.3-C | 收尾：GP-15 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/3.3.md](loops/3.3.md) |
| 3.4-S | 写并复核本闭环 3 份规格：EXM-03、ENG-01、ENG-02（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/3.4.md](loops/3.4.md) |
| 3.4-1 | 实现 EXM-03 个人考试日历与倒计时 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.4.md](loops/3.4.md) |
| 3.4-2 | 实现 ENG-01 递进提醒、通知中心与通道 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.4.md](loops/3.4.md) |
| 3.4-3 | 实现 ENG-02 触达纪律、免打扰与推送授权 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.4.md](loops/3.4.md) |
| 3.4-C | 收尾：GP-16 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/3.4.md](loops/3.4.md) |
| 3.5-S | 写并复核本闭环 3 份规格：PLAN-15、PLAN-16、LRN-11（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/3.5.md](loops/3.5.md) |
| 3.5-1 | 实现 PLAN-15 冲刺提议、今日三件事与考前保温 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.5.md](loops/3.5.md) |
| 3.5-2 | 实现 PLAN-16 考试当天静默与考务清单 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.5.md](loops/3.5.md) |
| 3.5-3 | 实现 LRN-11 登记成绩、预测校准与考后分流 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.5.md](loops/3.5.md) |
| 3.5-C | 收尾：GP-17 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/3.5.md](loops/3.5.md) |
| 3.6-S | 写并复核本闭环 4 份规格：PLAN-17、PLAN-18、PRAC-12、PRAC-13（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/3.6.md](loops/3.6.md) |
| 3.6-1 | 实现 PLAN-17 短时重组与三档降级 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.6.md](loops/3.6.md) |
| 3.6-2 | 实现 PLAN-18 中断回归、补充诊断与单项剔除 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.6.md](loops/3.6.md) |
| 3.6-3 | 实现 PRAC-12 复习加厚 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.6.md](loops/3.6.md) |
| 3.6-4 | 实现 PRAC-13 练习加厚 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/3.6.md](loops/3.6.md) |
| 3.6-C | 收尾：GP-18 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/3.6.md](loops/3.6.md) |
| P3-出 | 第 3 期期末：发布、观测、复盘、滚动细化下一期 | P7 | Codex ＋ 你 | 发布给受众环、看指标、确认下一期 | 出口标准逐条有证据 | [phase-3.md](phase-3.md) |
| P3-D | 决策点：选路线：继续默认 A，还是 B（机构试点先行） | — | 你 | 如果已有机构愿意付费试点、班上学员考的正是你的种子考试，可以选 B；否则继续 A。 | 写成 ADR（Codex 在主干用 new adr 分配编号）。 | [phase-3.md](phase-3.md) |
| P4-入 | 第 4 期期初检查：公开上线门槛 | P7 | Codex ＋ 你 | 确认外部事项 | 进入条件逐条有证据 | [phase-4.md](phase-4.md) |
| P4-TR | 并行事项：合规轨收口：外部事项到位 | — | 你 | 逐项确认：备案或登记、协议与隐私文本定稿、支付商户、内容授权。还没下来的，评估能否先开放不涉及受限能力的部分。 | 4 期进入条件：外部长交期事项已在 1 期启动并接近完成。 | [phase-4.md](phase-4.md) |
| 4.1-S | 写并复核本闭环 3 份规格：ACCT-04、ACCT-05、ACCT-06（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/4.1.md](loops/4.1.md) |
| 4.1-1 | 实现 ACCT-04 第三方与密码登录、换绑与补绑手机号 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.1.md](loops/4.1.md) |
| 4.1-2 | 实现 ACCT-05 设备管理、下线与登录提醒 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.1.md](loops/4.1.md) |
| 4.1-3 | 实现 ACCT-06 封禁、申诉与冷静期登录 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.1.md](loops/4.1.md) |
| 4.1-C | 收尾：GP-19 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/4.1.md](loops/4.1.md) |
| 4.2-S | 写并复核本闭环 5 份规格：COMP-02、COMP-03、COMP-04、COMP-05、COMP-06（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/4.2.md](loops/4.2.md) |
| 4.2-1 | 实现 COMP-02 年龄段确认与未成年人模式 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.2.md](loops/4.2.md) |
| 4.2-2 | 实现 COMP-03 数据总览、授权与自动化开关 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.2.md](loops/4.2.md) |
| 4.2-3 | 实现 COMP-04 注销、导出选项、回收站与高危确认 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.2.md](loops/4.2.md) |
| 4.2-4 | 实现 COMP-05 合规中心：个人信息请求、协议版本、授权记录与审计 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.2.md](loops/4.2.md) |
| 4.2-5 | 实现 COMP-06 备案台账、生成内容标识检查与宣传用语 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.2.md](loops/4.2.md) |
| 4.2-C | 收尾：GP-20 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/4.2.md](loops/4.2.md) |
| 4.4-S | 写并复核本闭环 4 份规格：SUPP-02、MOD-01、LRN-12、AIGOV-02（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/4.4.md](loops/4.4.md) |
| 4.4-1 | 实现 SUPP-02 工单、人工客服、系统公告与满意度 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.4.md](loops/4.4.md) |
| 4.4-2 | 实现 MOD-01 内容报错处理与下架修订 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.4.md](loops/4.4.md) |
| 4.4-3 | 实现 LRN-12 证据回溯重算 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.4.md](loops/4.4.md) |
| 4.4-4 | 实现 AIGOV-02 导师回答纠错闭环 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.4.md](loops/4.4.md) |
| 4.4-C | 收尾：GP-22 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/4.4.md](loops/4.4.md) |
| 4.5-S | 写并复核本闭环 3 份规格：ACCT-07、ACCT-08、PLAT-03（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/4.5.md](loops/4.5.md) |
| 4.5-1 | 实现 ACCT-07 员工登录、二次验证与会话安全 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.5.md](loops/4.5.md) |
| 4.5-2 | 实现 ACCT-08 后台角色权限与敏感操作分档确认 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.5.md](loops/4.5.md) |
| 4.5-3 | 实现 PLAT-03 操作审计与发布记录 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.5.md](loops/4.5.md) |
| 4.5-C | 收尾：GP-23 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/4.5.md](loops/4.5.md) |
| 4.6-S | 写并复核本闭环 6 份规格：PLAT-04、METR-04、AIGOV-03、AIGOV-04、AIGOV-05、MOD-02（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/4.6.md](loops/4.6.md) |
| 4.6-1 | 实现 PLAT-04 参数中心、功能开关与灰度 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.6.md](loops/4.6.md) |
| 4.6-2 | 实现 METR-04 运营驾驶舱与指标字典 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.6.md](loops/4.6.md) |
| 4.6-3 | 实现 AIGOV-03 场景注册、模型路由与额度限流 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.6.md](loops/4.6.md) |
| 4.6-4 | 实现 AIGOV-04 行为体台账、角色与提示词模板 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.6.md](loops/4.6.md) |
| 4.6-5 | 实现 AIGOV-05 发布阻断、幻觉溯源与 AI 监控 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.6.md](loops/4.6.md) |
| 4.6-6 | 实现 MOD-02 内容安全审核与危机响应 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.6.md](loops/4.6.md) |
| 4.6-C | 收尾：GP-24 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/4.6.md](loops/4.6.md) |
| 4.7-S | 写并复核本闭环 3 份规格：PRAC-14、ACCT-09、PLAT-05（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/4.7.md](loops/4.7.md) |
| 4.7-1 | 实现 PRAC-14 离线复习、离线作答与多端互斥 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.7.md](loops/4.7.md) |
| 4.7-2 | 实现 ACCT-09 学习、导师、阅读、外观与无障碍偏好 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.7.md](loops/4.7.md) |
| 4.7-3 | 实现 PLAT-05 容量预案与核心闭环保底 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.7.md](loops/4.7.md) |
| 4.7-C | 收尾：GP-25 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/4.7.md](loops/4.7.md) |
| P4-G | 受众环门槛：受众环 ring-2 门槛：可以公开免费注册 | — | 你 | 逐项确认门槛都已满足，缺一项就不扩大受众：不提前做（拖慢核心验证），也不拖后（挡住扩大受众）。 | 门槛清单全部满足：未成年人模式（4.2a）；授权与注销（4.2b、4.2d）；内容安全（4.6a、4.6b）；客服工单（4.4）；容量预案（4.7c）；外部手续 | [phase-4.md](phase-4.md) |
| 4.3-S | 写并复核本闭环 4 份规格：BILL-01、BILL-02、BILL-03、BILL-04（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/4.3.md](loops/4.3.md) |
| 4.3-1 | 实现 BILL-01 档位、额度与核心闭环不设限 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.3.md](loops/4.3.md) |
| 4.3-2 | 实现 BILL-02 购买、支付、订单、发票与退款 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.3.md](loops/4.3.md) |
| 4.3-3 | 实现 BILL-03 自动续费与扣款宽限 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.3.md](loops/4.3.md) |
| 4.3-4 | 实现 BILL-04 后台：用户、订单、套餐与权益 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/4.3.md](loops/4.3.md) |
| 4.3-C | 收尾：GP-21 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/4.3.md](loops/4.3.md) |
| P4-G | 受众环门槛：受众环 ring-3 门槛：可以开放付费 | — | 你 | 逐项确认门槛都已满足，缺一项就不扩大受众：不提前做（拖慢核心验证），也不拖后（挡住扩大受众）。 | 门槛清单全部满足：支付（4.3b、4.3c）；退款与发票（4.3e）；自动续费规则（4.3f）；“核心闭环不设限”的自动化测试（4.3a）。 | [phase-4.md](phase-4.md) |
| P4-出 | 第 4 期期末：发布、观测、复盘、滚动细化下一期 | P7 | Codex ＋ 你 | 发布给受众环、看指标、确认下一期 | 出口标准逐条有证据 | [phase-4.md](phase-4.md) |
| P5-入 | 第 5 期期初检查：通用化：任意考试可用 | P7 | Codex ＋ 你 | 确认外部事项 | 进入条件逐条有证据 | [phase-5.md](phase-5.md) |
| 5.1-S | 写并复核本闭环 4 份规格：EXM-04、EXM-05、EXM-06、EXM-07（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/5.1.md](loops/5.1.md) |
| 5.1-1 | 实现 EXM-04 官方考试库、就绪度与自然语言选考 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.1.md](loops/5.1.md) |
| 5.1-2 | 实现 EXM-05 自建目标、画像编辑与评价规则 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.1.md](loops/5.1.md) |
| 5.1-3 | 实现 EXM-06 目标主页、成绩有效期与证书路径 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.1.md](loops/5.1.md) |
| 5.1-4 | 实现 EXM-07 考试日历维护与公告核验 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.1.md](loops/5.1.md) |
| 5.1-C | 收尾：GP-26 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/5.1.md](loops/5.1.md) |
| 5.2-S | 写并复核本闭环 2 份规格：CONT-09、CONT-10（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/5.2.md](loops/5.2.md) |
| 5.2-1 | 实现 CONT-09 我的资料、导入向导与十类资料 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.2.md](loops/5.2.md) |
| 5.2-2 | 实现 CONT-10 任务中心、资产搬运与快速捕获 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.2.md](loops/5.2.md) |
| 5.2-C | 收尾：GP-27 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/5.2.md](loops/5.2.md) |
| 5.3-S | 写并复核本闭环 2 份规格：CONT-11、CONT-12（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/5.3.md](loops/5.3.md) |
| 5.3-1 | 实现 CONT-11 生成或对齐、对齐审核与资料体检 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.3.md](loops/5.3.md) |
| 5.3-2 | 实现 CONT-12 纸书影子书与外部课程伴学 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.3.md](loops/5.3.md) |
| 5.3-C | 收尾：GP-28 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/5.3.md](loops/5.3.md) |
| 5.4-S | 写并复核本闭环 4 份规格：MAP-04、MAP-05、MAP-06、MAP-07（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/5.4.md](loops/5.4.md) |
| 5.4-1 | 实现 MAP-04 地图三种来源、生成与类型标注 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.4.md](loops/5.4.md) |
| 5.4-2 | 实现 MAP-05 知识点管理、关系编辑与版本迁移 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.4.md](loops/5.4.md) |
| 5.4-3 | 实现 MAP-06 地图批量操作、一键行动与手机视图 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.4.md](loops/5.4.md) |
| 5.4-4 | 实现 MAP-07 后台地图编辑、类型库与发布 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.4.md](loops/5.4.md) |
| 5.4-C | 收尾：GP-29 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/5.4.md](loops/5.4.md) |
| 5.5-S | 写并复核本闭环 1 份规格：MAP-08（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/5.5.md](loops/5.5.md) |
| 5.5-1 | 实现 MAP-08 地图体检与锁定 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.5.md](loops/5.5.md) |
| 5.5-C | 收尾：GP-30 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/5.5.md](loops/5.5.md) |
| 5.6-S | 写并复核本闭环 4 份规格：CONT-13、CONT-14、PRAC-15、MOD-03（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/5.6.md](loops/5.6.md) |
| 5.6-1 | 实现 CONT-13 我的题库、批量导入与题目编辑 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.6.md](loops/5.6.md) |
| 5.6-2 | 实现 CONT-14 拍照识题与导师出题 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.6.md](loops/5.6.md) |
| 5.6-3 | 实现 PRAC-15 异题印证与生成题先做后核 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.6.md](loops/5.6.md) |
| 5.6-4 | 实现 MOD-03 题库审核、生成题质检与可信度升级 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.6.md](loops/5.6.md) |
| 5.6-C | 收尾：GP-31 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/5.6.md](loops/5.6.md) |
| 5.7-S | 写并复核本闭环 4 份规格：CONT-15、CONT-16、MOD-04、COMP-07（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/5.7.md](loops/5.7.md) |
| 5.7-1 | 实现 CONT-15 模板大厅、扩展包挂载与整包导出 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.7.md](loops/5.7.md) |
| 5.7-2 | 实现 CONT-16 模板发布、作者中心与官方学习包 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.7.md](loops/5.7.md) |
| 5.7-3 | 实现 MOD-04 模板审核、质量画像、举报下架与推荐 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.7.md](loops/5.7.md) |
| 5.7-4 | 实现 COMP-07 内容来源、授权合同、真题规范与侵权处理 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.7.md](loops/5.7.md) |
| 5.7-C | 收尾：GP-32 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/5.7.md](loops/5.7.md) |
| 5.8-S | 写并复核本闭环 1 份规格：PLAN-19（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/5.8.md](loops/5.8.md) |
| 5.8-1 | 实现 PLAN-19 多目标并行与跨目标重叠 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/5.8.md](loops/5.8.md) |
| 5.8-C | 收尾：GP-33 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/5.8.md](loops/5.8.md) |
| P5-出 | 第 5 期期末：发布、观测、复盘、滚动细化下一期 | P7 | Codex ＋ 你 | 发布给受众环、看指标、确认下一期 | 出口标准逐条有证据 | [phase-5.md](phase-5.md) |
| P6-入 | 第 6 期期初检查：深度学法 | P7 | Codex ＋ 你 | 确认外部事项 | 进入条件逐条有证据 | [phase-6.md](phase-6.md) |
| P6-TR | 并行事项：准备批改一致性评测集 | — | 你 | 为目标考试的主观题收集一批由专家（或你信得过的老师）打过分的作答，作为批改一致性的“标准答案”。 | 评测集已准备，脚本能跑出一致性指标（6 期进入条件）。 | [phase-6.md](phase-6.md) |
| 6.1-S | 写并复核本闭环 4 份规格：GRADE-01、GRADE-02、GRADE-03、GRADE-04（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/6.1.md](loops/6.1.md) |
| 6.1-1 | 实现 GRADE-01 主观题提交、三种评分方式与消耗告知 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.1.md](loops/6.1.md) |
| 6.1-2 | 实现 GRADE-02 得分点对照、分数区间与评分细则 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.1.md](loops/6.1.md) |
| 6.1-3 | 实现 GRADE-03 逐句批注、升格示范、重写再批与追问 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.1.md](loops/6.1.md) |
| 6.1-4 | 实现 GRADE-04 问题模式追踪、规范表述与限时写作 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.1.md](loops/6.1.md) |
| 6.1-C | 收尾：GP-34 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/6.1.md](loops/6.1.md) |
| 6.2-S | 写并复核本闭环 3 份规格：PRAC-16、PRAC-17、PRAC-18（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/6.2.md](loops/6.2.md) |
| 6.2-1 | 实现 PRAC-16 渐进挖空、逐级比对与统一调度 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.2.md](loops/6.2.md) |
| 6.2-2 | 实现 PRAC-17 要点背诵、口述、默写与讲给导师听 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.2.md](loops/6.2.md) |
| 6.2-3 | 实现 PRAC-18 对比记忆、口诀、听背、数字专项与收尾段 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.2.md](loops/6.2.md) |
| 6.2-C | 收尾：GP-35 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/6.2.md](loops/6.2.md) |
| 6.3-S | 写并复核本闭环 3 份规格：CONT-17、CONT-18、CONT-19（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/6.3.md](loops/6.3.md) |
| 6.3-1 | 实现 CONT-17 统一播放器、知识点时间轴与片内检测 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.3.md](loops/6.3.md) |
| 6.3-2 | 实现 CONT-18 问这一刻、打点笔记、逐字稿与续听 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.3.md](loops/6.3.md) |
| 6.3-3 | 实现 CONT-19 外部课伴学、教材音频化与讲解风格 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.3.md](loops/6.3.md) |
| 6.3-C | 收尾：GP-36 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/6.3.md](loops/6.3.md) |
| 6.4-S | 写并复核本闭环 2 份规格：GRADE-05、GRADE-06（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/6.4.md](loops/6.4.md) |
| 6.4-1 | 实现 GRADE-05 口头表达仿真与追问 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.4.md](loops/6.4.md) |
| 6.4-2 | 实现 GRADE-06 多维评估、逐字稿批注与重答对比 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.4.md](loops/6.4.md) |
| 6.4-C | 收尾：GP-37 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/6.4.md](loops/6.4.md) |
| 6.5-S | 写并复核本闭环 1 份规格：CONT-20（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/6.5.md](loops/6.5.md) |
| 6.5-1 | 实现 CONT-20 统一搜索、速查表与拍照搜题 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.5.md](loops/6.5.md) |
| 6.5-C | 收尾：GP-38 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/6.5.md](loops/6.5.md) |
| 6.6-S | 写并复核本闭环 5 份规格：PRAC-19、PRAC-20、MAP-09、PRAC-21、LRN-13（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/6.6.md](loops/6.6.md) |
| 6.6-1 | 实现 PRAC-19 错因第二层、三步订正、顽固题与陷阱画像 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.6.md](loops/6.6.md) |
| 6.6-2 | 实现 PRAC-20 聚类洞察、根因追溯与攻坚包 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.6.md](loops/6.6.md) |
| 6.6-3 | 实现 MAP-09 关联知识、易混对比与错误模式归纳 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.6.md](loops/6.6.md) |
| 6.6-4 | 实现 PRAC-21 提示阶梯、引导式纠错与分步判分 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.6.md](loops/6.6.md) |
| 6.6-5 | 实现 LRN-13 把握度校准与策略模拟 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.6.md](loops/6.6.md) |
| 6.6-C | 收尾：GP-39 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/6.6.md](loops/6.6.md) |
| 6.7-S | 写并复核本闭环 4 份规格：TUTOR-05、TUTOR-06、CONT-21、TUTOR-07（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/6.7.md](loops/6.7.md) |
| 6.7-1 | 实现 TUTOR-05 导师多模式、快捷提示与按环节的能力 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.7.md](loops/6.7.md) |
| 6.7-2 | 实现 TUTOR-06 导师长期记忆可管理 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.7.md](loops/6.7.md) |
| 6.7-3 | 实现 CONT-21 笔记整理、收藏、导图与个人一本通 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.7.md](loops/6.7.md) |
| 6.7-4 | 实现 TUTOR-07 对话式调整、一句话组卷、教练点评与报告解读 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/6.7.md](loops/6.7.md) |
| 6.7-C | 收尾：GP-40 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/6.7.md](loops/6.7.md) |
| P6-出 | 第 6 期期末：发布、观测、复盘、滚动细化下一期 | P7 | Codex ＋ 你 | 发布给受众环、看指标、确认下一期 | 出口标准逐条有证据 | [phase-6.md](phase-6.md) |
| P7-入 | 第 7 期期初检查：机构端 MVP | P7 | Codex ＋ 你 | 确认外部事项 | 进入条件逐条有证据 | [phase-7.md](phase-7.md) |
| P7-TR | 并行事项：落实试点机构 | — | 你 | 找到一到三家愿意试点的机构，各一个班，学员考的最好正是你的种子考试；约定手工开通、线下结算；告诉机构：学员加入前会看到机 | 至少一家试点机构就位（7 期进入条件）。 | [phase-7.md](phase-7.md) |
| 7.1-S | 写并复核本闭环 4 份规格：ORG-01、ORG-02、ACCT-10、BILL-05（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/7.1.md](loops/7.1.md) |
| 7.1-1 | 实现 ORG-01 机构入驻、合同、租户隔离与不可移除标识 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.1.md](loops/7.1.md) |
| 7.1-2 | 实现 ORG-02 组织架构、角色矩阵、数据范围与审计 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.1.md](loops/7.1.md) |
| 7.1-3 | 实现 ACCT-10 机构员工登录与安全基线 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.1.md](loops/7.1.md) |
| 7.1-4 | 实现 BILL-05 机构套餐、席位与账单 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.1.md](loops/7.1.md) |
| 7.1-C | 收尾：GP-41 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/7.1.md](loops/7.1.md) |
| 7.2-S | 写并复核本闭环 3 份规格：ORG-03、COMP-08、ORG-04（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/7.2.md](loops/7.2.md) |
| 7.2-1 | 实现 ORG-03 班级、学员导入与加入邀请 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.2.md](loops/7.2.md) |
| 7.2-2 | 实现 COMP-08 学员对机构的逐项授权 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.2.md](loops/7.2.md) |
| 7.2-3 | 实现 ORG-04 分层列表、调班转班与批量操作 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.2.md](loops/7.2.md) |
| 7.2-C | 收尾：GP-42 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/7.2.md](loops/7.2.md) |
| 7.3-S | 写并复核本闭环 2 份规格：ORG-05、PLAN-20（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/7.3.md](loops/7.3.md) |
| 7.3-1 | 实现 ORG-05 教学计划模板与作业布置 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.3.md](loops/7.3.md) |
| 7.3-2 | 实现 PLAN-20 机构任务与课表进入学员今日 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.3.md](loops/7.3.md) |
| 7.3-C | 收尾：GP-43 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/7.3.md](loops/7.3.md) |
| 7.4-S | 写并复核本闭环 3 份规格：ORG-06、ORG-07、ORG-08（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/7.4.md](loops/7.4.md) |
| 7.4-1 | 实现 ORG-06 角色化工作台与班级健康度 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.4.md](loops/7.4.md) |
| 7.4-2 | 实现 ORG-07 学员 360 与可见范围说明 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.4.md](loops/7.4.md) |
| 7.4-3 | 实现 ORG-08 风险名单、联系清单与减负建议 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.4.md](loops/7.4.md) |
| 7.4-C | 收尾：GP-44 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/7.4.md](loops/7.4.md) |
| 7.5-S | 写并复核本闭环 1 份规格：ORG-09（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/7.5.md](loops/7.5.md) |
| 7.5-1 | 实现 ORG-09 批改工作台：预批改、分流与抽检 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.5.md](loops/7.5.md) |
| 7.5-C | 收尾：GP-45 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/7.5.md](loops/7.5.md) |
| 7.6-S | 写并复核本闭环 1 份规格：ORG-10（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/7.6.md](loops/7.6.md) |
| 7.6-1 | 实现 ORG-10 班级考试与讲评 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.6.md](loops/7.6.md) |
| 7.6-C | 收尾：GP-46 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/7.6.md](loops/7.6.md) |
| 7.7-S | 写并复核本闭环 2 份规格：ORG-11、ORG-12（已 ready 的跳过） | P1 | Codex 写 → Claude 复核 → 你确认 | 读业务摘要，回复“确认”或修改意见；搬运 1 组压缩包 | 本闭环规格全部 ready，check 通过，规格分支已合并 | [loops/7.7.md](loops/7.7.md) |
| 7.7-1 | 实现 ORG-11 机构内容库、地图挂接与分发 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.7.md](loops/7.7.md) |
| 7.7-2 | 实现 ORG-12 机构答疑与学员数据带走 | P2 | Codex 计划 → Claude 实现 → Codex 验证与复查 | 回复“确认计划”；搬运压缩包（通常 1–2 组） | 主干上 roadmap.md 推导为“完成”：每条 AC 都有通过的测试 | [loops/7.7.md](loops/7.7.md) |
| 7.7-C | 收尾：GP-47 全绿、走查、记校准 | P6 | Codex ＋ 你 | 手机与桌面各走一遍演示（约 10 分钟），回复“通过”或问题 | 黄金路径全绿；你走查通过；docs/product/calibration.yaml 记一行 | [loops/7.7.md](loops/7.7.md) |
| P7-G | 受众环门槛：受众环 ring-4 门槛：可以给试点机构用 | — | 你 | 逐项确认门槛都已满足，缺一项就不扩大受众：不提前做（拖慢核心验证），也不拖后（挡住扩大受众）。 | 门槛清单全部满足：租户隔离（7.1b）；员工账号安全（4.5、7.1d）；数据四分类授权（4.2、7.2b）；审计日志（4.2e、7.1e）。 | [phase-7.md](phase-7.md) |
| P7-出 | 第 7 期期末：发布、观测、复盘、滚动细化下一期 | P7 | Codex ＋ 你 | 发布给受众环、看指标、确认下一期 | 出口标准逐条有证据 | [phase-7.md](phase-7.md) |
| P8-池 | 8 期以后：每期结束从主题池挑选，按同样标准写假设、受众与闭环 | P7 | Codex 起草 → 你确认 | 选主题 | phases.yaml 增加新一期 | [phase-8.md](phase-8.md) |
