---
applies_to: ["contracts/schema/**", "packages/domains/**"]
---
# 数据约定

## 规则
1. 每张表一个文件 contracts/schema/<表名>.yaml，写明 owner；只有 owner 领域的代码写这张表，其他领域经 owner 的接口读写。
2. 每个字段标 x-data-class，取值见 contracts/data-classes.yaml。
3. 业务表都有 tenant_id（ADR-011）：个人数据取平台默认租户，机构任务数据取机构租户；查询带租户条件。
4. append_only 的表只插入：不更新、不删除；撤回写一条撤回事件，派生数据从源事件重算（ADR-005）。
5. 主键用 UUIDv7，时间字段存 UTC；删除先进回收站（deleted_at），彻底删除按数据类别的保留期执行。
6. 迁移脚本提交后不再修改；结构变化写新的迁移，并与 schema 文件在同一次提交。

## 示例
- 正例：practice 的作答服务调用 learner 的 `recordEvidence` 接口；evidence_events 只由 learner 写入，被改了答案的题由一条 revoke 事件撤回原证据，掌握档随之重算。
- 反例：practice 直接 `UPDATE mastery_levels SET level = level + 1`：越过证据账本写派生数据，检查 E-OWN-02 会拦下。

## 理由
证据是学习者模型的唯一输入；只追加、可重算，算法升级和题目纠错才不会丢失或污染历史。租户字段与数据类别是一向门：后补意味着改全部查询（见 ADR-011、ADR-006）。
