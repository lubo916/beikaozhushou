---
id: MAP-01
status: draft
refs:
  schema: [knowledge_maps, knowledge_points, knowledge_point_mappings]
  api: [getKnowledgePoint]
  permissions: [map.knowledge_point.read]
  adr: [ADR-009]
---
# MAP-01 知识地图模型：稳定 ID、版本与扩展层

## 1 目标与边界
知识地图有稳定的知识点身份、版本与扩展层，学习记录可以随地图更新迁移（分期规划 0.2a，ADR-009）。
不做：地图生成、编辑与体检界面（5.4、5.5）。

## 2 业务规则
- R1 节点分科目、章、节、知识点四种；知识点是叶子节点，证据只挂在知识点上。
- R2 知识点 ID 稳定不复用，不随改名、移动、版本变化。
- R3 每个知识点标一至两个知识类型（glossary 的九类），并可有默认目标档。
- R4 底图与扩展层分开：官方或模板节点只读，个人与机构只能在扩展层新增。
- R5 改名、移动、合并、拆分、退役写入只追加的映射，记录起止版本。
- R6 按映射迁移时：合并后的点汇总原点的学习记录；拆分出的新点标“证据不足”，不清零。

## 3 界面
无（知识点页与方格在 MAP-02）。

## 4 数据
表 knowledge_maps、knowledge_points、knowledge_point_mappings；接口 getKnowledgePoint，动作 map.knowledge_point.read。

## 5 AI 行为
无。

## 6 验收
- MAP-01-AC1 改名或移动知识点后 ID 不变，旧证据仍指向它。
- MAP-01-AC2 在官方节点上新增子节点被拒绝，在扩展层新增成功。
- MAP-01-AC3 合并两个点后，新点能取到两者的全部证据。
- MAP-01-AC4 拆分后的新点状态为证据不足，原有证据保留可查。
- MAP-01-AC5 知识类型超过两个时保存失败。

## 7 不变量与合规
无。
