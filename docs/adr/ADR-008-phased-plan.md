# ADR-008 分期规划接入文档体系

- 状态：已采纳

## 背景

《功能开发分期规划》（新编号版）把 961 个在用条目编成 9 期、51 个闭环，定义受众环、黄金路径、预算与熔断；实施步骤表把它细化为 274 个切片，每个切片有类型、原型条目、验收句与轮次。文档体系 V3.1 的路线图只有 release，没有期、闭环与切片；规划第 9 章的项目记忆文件、闭环卡、切片卡、完成定义与校准表也要落到两个工具都看得见的载体上。

## 决定

1. release 与期的对应：R1＝0–1 期，R2＝2–3 期，R3＝4 期，later＝5 期及以后（含 8+ 主题池）。R1 共 31 个功能，高于 V3.1 的经验值 15–25，按规划保留。
2. docs/product/phases.yaml 是受众环、期、闭环、切片、黄金路径、轨道、路线变体与风险的唯一来源。受众环写作 ring-0 至 ring-4，避免与 release 混淆。功能所属的闭环只记在这里，roadmap.yaml 的字段不变。
3. 切片：每个闭环的 slices 列出编号、类型、原型条目、验收句与轮次；切片的条目必须由同一闭环的功能覆盖（E-PHASE-05）。没有条目的切片写 carrier（承担它的功能、ADR、待定问题或文件）。一个功能承担一到三个切片，切片的验收句是该功能 AC 的种子。4–7 期的切片为建议稿（suggested: true），期初复核。
4. 校准：docs/product/calibration.yaml 记录每个闭环的开卡、收尾、实际轮次与熔断，以及当前校准系数（规划 3.3、9.6）。超过熔断线又没有熔断记录时告警（W-PHASE-07）。
5. 项目记忆文件不另建，落在已有载体：一句话产品与开发规则在根 AGENTS.md 与约定；当前期、当前闭环与下一步由 `spec_tool status` 推导，并由 SessionStart hook 提示；决定在 docs/adr/；术语在 glossary.yaml；架构在 ADR-002、ADR-003 与 domain-map.yaml；闭环卡是 phases.yaml 的闭环条目（`status --loop <闭环>` 输出）；进度表是 gen 生成的 docs/product/progress.md；参数说明在 contracts/params.yaml；黄金路径测试放 tests/golden/，标题带 [GP-<n>]；种子在 fixtures/exams/；探针结论先记在 OQ-002 至 OQ-005，定稿为 ADR。
6. 切片卡由任务包与 work 文件代替；闭环开卡与收尾用 open-loop、close-loop 两个手动技能，收尾技能包含规划 9.4 的完成定义。
7. 分期检查：E-PHASE-01（功能恰好属于一个闭环）、E-PHASE-02（闭环引用的功能存在）、E-PHASE-03（同一期的 release 一致）、W-PHASE-04（闭环缺演示或预算）、E-PHASE-05（切片编号唯一、条目由本闭环的功能覆盖、carrier 可解析）、E-PHASE-06（校准记录指向存在的闭环且字段合法）、W-PHASE-07（超熔断线未熔断）。
8. 实施步骤表按新编号重排后存于归档 planning/；旧编号原件存于 planning/superseded/。

## 后果

- 路线图与进度视图按期、闭环与切片分组；status 是每个会话的起点。
- docs/meta/doc-system.md 保持 V3.1 原文，本 ADR 的扩展在下一版并入。
- 何时重新考虑：每期结束滚动细化下一期时，按实测修订 phases.yaml 的预算与切片。
