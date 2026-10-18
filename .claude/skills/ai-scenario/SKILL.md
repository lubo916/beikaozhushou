---
name: ai-scenario
description: 新增或修改 AI 场景：登记、输出结构、提示词、评测与阈值。Add or change an AI scenario with prompts, evals and thresholds. 仅在用户明确调用时使用。
argument-hint: <场景ID或功能ID>
disable-model-invocation: true
metadata:
  invocation: manual
  args: <场景ID或功能ID>
  generated_from: .agents/skills/ai-scenario/SKILL.md
  source_sha: "081813563e42"
---
# AI 场景

输入：调用消息中给出的场景 ID（<领域>.<名称>）或功能 ID。没有给出就先问。

1. 读 contracts/ai/scenarios.yaml、contracts/ai/actors.yaml 的相关条目，以及场景引用的不变量（docs/product/invariants.yaml）。
2. 场景不存在时按重型通道新增：请用户在主干运行 `python scripts/spec_tool.py new scenario <领域>.<名称> --actor <执行者>`，再按附录 D.6 补齐用途、页面、输入输出结构、numbers_from、模型档位、计量、降级方式与文案键、确认方式、标识、读取的数据类别、不变量与开关。
3. 先在 packages/ai/<场景>/ 定义输出结构，再写提示词。输出中的数字类字段只能来自 numbers_from 列出的算法字段。
4. 在 evals/<场景>/ 准备评测：cases/ 为用例（含人工金标，起步约 30 条），graders/ 为判分器（模型判分附与人工评分的校准记录），thresholds.yaml 为各指标阈值，baseline.json 为当前基线。“多次独立评分取区间、一致性不达标只给要点”这类要求写成阈值，不写成确定性测试。
5. 降级路径要有测试：服务不可用时按 fallback 给出替代，今日清单与复习照常（INV-04）。
6. 运行 `python scripts/spec_tool.py eval <场景> --suite regression`，达到阈值且不低于基线；更新基线须人确认。
7. 运行 `python scripts/spec_tool.py check` 直到通过。
