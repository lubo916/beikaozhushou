---
name: add-exam
description: "接入一个新考试：画像数据、结构校验、演示数据与端到端冒烟。Onboard a new exam: profile, schema check, fixtures, e2e smoke. 仅在用户明确调用时使用。"
metadata:
  invocation: manual
  args: "<考试名或考试ID>"
---

# 接入考试

输入：调用消息中给出的考试名称或考试 ID。没有给出就先问。

1. 对照 docs/product/variation-points.md，判断新考试能否只靠考试画像数据表达。需要新的扩展点就停下，向用户提出重型通道变更。
2. 在 fixtures/exams/<考试ID>/ 写 profile.json（符合 contracts/exam-profile.schema.json）、knowledge-map.json 与 questions.json；题目与解析须有合法来源。
3. 运行 `python scripts/spec_tool.py check`，确认没有 E-EXAM-02。
4. 跑“今日清单 → 做题 → 错题回炉”端到端冒烟，以及相关评测的考试维度子集。
5. 确认核心领域代码中没有出现该考试的 ID 或名称（E-EXAM-01）。
