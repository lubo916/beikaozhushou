# learner：学习者模型

## 要点

- 职责：证据账本（只追加）、六档掌握派生、证据充分性、记忆状态、摸底估计与预测。算法见 docs/models/learner-model.md、srs.md、prediction.md。
- 证据与掌握档只由本领域写入；practice、grading、content 经 recordEvidence 提交证据，不直接写表（ADR-005、E-OWN-02）。
- 强度分强、中、弱、负、待验证；蒙对或用时过短的正确作答为待验证，不升档（INV-25）；题目可信度决定上限（ADR-010）。
- 撤回写 revoke 事件后重算；全量重算与增量结果一致。档位变化发布 mastery.changed，plan 与 map 订阅。
- 自评只显示，通过检验题才作为证据生效；在场时长不是证据，有效学习只按证据计。
