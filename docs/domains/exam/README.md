# exam：考试画像

## 要点

- 职责：考试画像库（结构、题型、评价规则、关键日期、就绪程度）、考试日历、考情档案、扩展包挂载。
- 考试差异只进画像数据或 docs/product/variation-points.md 登记的扩展点；核心领域代码不出现考试 ID 或名称（INV-26、E-EXAM-01）。
- 画像结构为 contracts/exam-profile.schema.json；演示考试见 fixtures/exams/。
- 官方未公布的日期标“预计”并注明依据（S02-07）。
