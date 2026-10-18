# map：知识地图

## 要点

- 职责：知识点的稳定身份与版本、章节层级、知识类型（九类）、关系与前置、底图与扩展层、地图体检与锁定。
- 知识点 ID 稳定不复用；改名、移动、合并、拆分写入映射，学习记录按映射迁移，拆分后的点标“证据不足”而不清零（ADR-009）。
- 官方节点只读，个人与机构只能在扩展层增加节点。
- 知识点页与方格全景的界面在本领域；方格的着色数据读自 learner。

相关参数：`map.health.min_kp_count`、`map.health.min_question_coverage`、`map.health.max_missing_target_ratio`（取值见 contracts/params.yaml）。
