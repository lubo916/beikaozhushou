---
id: EXM-01
status: draft
refs:
  schema: [exam_profiles]
  api: [getExamProfile]
  permissions: [exam.profile.read]
  data_classes: [public_content]
  inv: [INV-26]
---
# EXM-01 考试画像结构与评价规则

## 1 目标与边界
一门考试的差异全部用画像数据表达：结构、题型、评价规则、关键日期与就绪程度（分期规划 0.2a）。四个演示考试都能载入并按各自的评价规则判定结果。
不做：考试库检索、自建目标向导与画像编辑界面（5.1）。

## 2 业务规则
- R1 画像按 contracts/exam-profile.schema.json 校验，不合法的拒绝入库并给出字段路径。
- R2 评价规则四选一：合格线型按合格线判定，可要求各科均过线；择优型以自设目标分为准并可参考历年线；分数段型按分数段给出所在段；自定型以用户填写的目标为准。
- R3 官方未公布的日期标“预计”并保存依据；自定目标也必须有一个目标日。
- R4 就绪程度按地图、题目、考情三项各给一到三级与说明。
- R5 核心领域代码只读画像字段，不出现考试 ID 或名称（INV-26）。

## 3 界面
无（画像在 2.1 的确认画像面板中呈现）。

## 4 数据
表 exam_profiles（完整画像存 profile 字段，字段类别 public_content）；接口 getExamProfile，动作 exam.profile.read。

## 5 AI 行为
无。

## 6 验收
- EXM-01-AC1 fixtures/exams/ 下四个演示考试的 profile.json 全部通过校验并能读回。
- EXM-01-AC2 缺少 evaluation_rule 的画像被拒绝，错误指出字段路径。
- EXM-01-AC3 合格线型且要求各科过线时，一科低于合格线即判定未通过。
- EXM-01-AC4 分数段型给出分数所在的段名。
- EXM-01-AC5 日期状态为预计时，读回结果带依据说明。

## 7 不变量与合规
INV-26：考试差异只进画像或登记的扩展点。
