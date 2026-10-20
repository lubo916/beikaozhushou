# 地基文档目录

> 这里放“跨页面、改起来贵”的约定，只写现状，不写历史。每份 300 行以内。
> 只有地基任务（F 开头）和整合任务（I、B21）可以改这里，规则卡归 R 任务；其他任务需要改，写进交接单。

| 文件 | 管什么 | 谁要读 |
|---|---|---|
| decision-sheet.md | 开工决策单：15 件事与默认值；已定稿（全部按默认，见 docs/decisions/D-2026-10-20-kickoff.md） | 查开工决定时 |
| tech.md | 技术栈、锁定版本、目录结构、登录与多端、网页沙箱与本地环境的注意事项 | 工程类任务 |
| vocabulary.md | 统一词汇：掌握六档、知识类型、错因、陷阱、页面状态与模式、三个数、考试与资料等 | 所有任务 |
| pages.md | 70 页清单：路由、分组、模式、视图、功能点数量 | 页面任务 |
| ui-rules.md | 设计令牌、断点、外壳、页面状态、文案、组件、样板页 | 页面任务 |
| api-rules.md | 接口约定、页面怎么拿数据、假数据与真假切换 | 页面任务、后端任务 |
| data-model.md | 核心对象与关系、11 个一向门决定、硬规则 | 后端任务、规则卡 |
| metrics.md | 统计口径：三个数、有效学习、正确率、地图上的数等 | 规则卡、后端、报告类页面 |
| golden-paths.md | 6 条黄金路径：冒烟测试与走查的依据 | 测试任务、整合任务 |
| errata.md | 原型勘误表：原型前后矛盾、或与词汇和参数冲突的地方，以“采用”一列为准 | 页面任务、规则卡 |
| rule-cards/ | 规则卡：原型上看不见的业务规则，例子即规格 | 对应的后端任务 |

权威顺序：红线（AGENTS.md）＞ docs/decisions/ 里你拍板的决定 ＞ 本目录（含勘误表）＞ 原型 ＞ 其他（V3 的 ADR 与约定只作参考，冲突以本目录为准）。

单一来源（V3 留下的内容资产，开工决定第 14 条保留）：

- 术语：docs/product/glossary.yaml。vocabulary.md 是它的人读摘要，冲突以 yaml 为准并记进勘误表。
- 参数：contracts/params.yaml，规则数字的默认值（开工决定第 7 条）。
- 令牌 design/tokens.json；错误码 contracts/errors.yaml；数据类别 contracts/data-classes.yaml；权限 contracts/permissions.yaml；平台指标口径 contracts/metrics.yaml；领域依赖方向 docs/product/domain-map.yaml。
- 算法说明 docs/models/（learner-model、srs、planner、prediction）及例子表 tests/models/，规则卡起草时沿用。
