# 计划引擎

生成与重排学习计划和今日清单的确定性算法，不依赖大模型（INV-04），是唯一能自动顺延的执行者（INV-01）。启发式的定稿见 OQ-005（探针 0.4D）。

## 输入 <a id="inputs"></a>
- 目标：考试画像、目标分与目标日（S02-06、S02-07）。
- 时间预算与占用（time_budgets、time_reservations）：机构作业与课表先占用，个人任务避让（ADR-016）。
- 掌握档、目标档、证据充分性与范围状态；知识点的考频、分值与重要度。
- 到期队列：错题回炉、卡片复习、待验证复核等到期项（由各领域按 plan 的接口提供）。

## 输出 <a id="outputs"></a>
- 今日清单：每项带所属段、任务来源、估计用时、理由字段（数字只来自本算法的输出，INV-02）。
- 提议（proposals）与重排记录（INV-27）。

## 每日预算与配比 <a id="daily-budget"></a>
- 当日可用分钟数 = 当日预算 − 当日占用。
- 有到期项时，巩固段至少占当日可用时间的 plan.consolidate.min_ratio，新学不得挤占（S06-13）。
- 推进段与收尾段按学习计划中的配比模式分配（按性价比、复习优先、新学优先，S06-02）。

## 任务生成 <a id="task-generation"></a>
- 巩固段取到期队列中当天到期的项（到期复习、错题回炉、待验证复核）。
- 推进段按提分性价比排序：(目标档 − 当前档) × 重要度 ÷ 估计用时；只取学习范围内的知识点。
- 每项理由列出考频、分值、档位差、到期时间等算法字段，文案只插值（S06-05）。

## 排序 <a id="ordering"></a>
先做推迟有损失的（巩固段，按到期时间与遗忘风险），再做推迟无损失的（推进段，按性价比与计划）（S06-04）。

## 顺延 <a id="carryover"></a>
- 夜间只做顺延与分摊并记录原因；白天只响应用户操作与机构任务避让（S07-06）。
- 没做完的任务在之后 plan.carryover.search_days 天内找空位；每周预留 plan.week.buffer_ratio 的缓冲；排不下则生成提议（S07-08）。
- 自动顺延次日告知，plan.proposal.undo_days 天内可撤销（S06-10）。

## 提议 <a id="proposals"></a>
- 改目标、范围、轮次只以提议出现，写明改什么、为什么、代价、不改会怎样；确认后执行（ADR-013）。
- 每次变动写入重排记录，原因与代价可查、可撤销（S07-10）。

## 断连与不可学 <a id="disconnect"></a>
- 按中断天数分档（plan.disconnect.tiers_days）；回来不展示累计未完成量，先给一个约 plan.disconnect.start_task_minutes 分钟的启动任务，积压的到期项按考频乘遗忘风险取最要紧的一批，其余顺延（S06-11）。
- 不可学日只保留到期复习的最小版，其余自动顺延，不出现“落后”字样（S06-17）。

## 完成判定 <a id="completion"></a>
- 做对、答出、背出才算完成；手动勾选只记“看过”（S06-07）。
- 今日清单完成率 = 当天完成项数 ÷ 当天计划项数（剔除写明原因的项不计入分母）。
- 巩固段完成率 = 巩固段完成项数 ÷ 巩固段计划项数。

## 引用的参数 <a id="params"></a>
plan.consolidate.min_ratio、plan.week.buffer_ratio、plan.carryover.search_days、plan.proposal.undo_days、plan.disconnect.tiers_days、plan.disconnect.start_task_minutes。

## 验收方式 <a id="acceptance"></a>
- tests/models/planner/ 保存模拟场景：一个月的随机完成与缺勤序列下，巩固段保底从不被突破，顺延不丢任务，排不下的都转为提议（探针 0.4D）。
- 理由文案中的每个数字都能在当天的引擎输出中找到。

## 补充引用的参数

- `plan.report.min_days`：一周至少有几天学习记录才生成周报
- `plan.report.min_effective_minutes`：一周有效学习不足该时长时只给数据不给结论
- `plan.consolidate.sprint_ratio`：冲刺期巩固段下限
- `plan.short_mode.minutes`：短时重组的默认时长
- `plan.sprint.days_before`：距目标日几天起提议进入冲刺模式
- `plan.calibrate.weeks`：声明与实测连续相差几周后提议校准
- `plan.calibrate.gap_ratio`：声明与实测相差超过该比例视为不符
