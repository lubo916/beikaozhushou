# practice：练习

## 要点

- 职责：作答与揭晓、练习与模考会话、错题收录与回炉、复习卡片与复习会话、背诵训练；实现 plan 定义的到期队列接口。
- 固定流程：作答、选把握度、提交、揭晓；揭晓后不能改答案（INV-24）。把握度必选无默认，可关闭。
- 每次揭晓经 recordEvidence 交给 learner 计算证据强度，本领域不判定档位。
- 错题四个状态：新增、回炉中、待验收、已毕业；回炉间隔与毕业次数取参数（docs/models/srs.md 的错题回炉一节）。
- 复习的四级自评翻面后才出现；超过每日上限的到期项顺延不删。

相关参数：`practice.mistake.stubborn_fail_count`、`practice.smart.target_accuracy`（取值见 contracts/params.yaml）。
