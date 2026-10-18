# 记忆调度

决定每个复习项（卡片、背诵段、错题）的下次到期时间，并在每日上限内选出最要紧的一批。算法选型与默认参数由探针 0.4B 定稿（OQ-003）。

## 输入 <a id="inputs"></a>
- 记忆状态（稳定度、难度、上次复习时间、遗忘次数）。
- 每次复习的自评（四级，翻面后才出现、不设默认，S15-02）与用时。
- 目标日、目标保持率、每日上限。

## 输出 <a id="outputs"></a>
- 每个复习项的下次到期时间；当天到期队列（按紧要程度排序）。
- 每次复习结果作为证据提交给学习者模型（来源 review）。

## 不变量 <a id="invariants"></a>
- 不依赖大模型（INV-04）。
- 用时短于 learner.memory.min_rating_seconds 的评级不计入（S15-11）。
- 超出上限的到期项顺延，不删除（S15-08）。

## 记忆状态 <a id="memory-state"></a>
记忆状态的字段随选定算法确定；更新只发生在一次计入的复习之后。

## 复习间隔 <a id="review-interval"></a>
以目标日的可提取度为目标：间隔取使目标日预测保持率不低于 learner.memory.target_retention 的最长间隔；分值高的知识点复习更密（S15-07）。

## 评分 <a id="rating"></a>
- 选“忘了”的项在 practice.recall.relearn_delay_minutes 分钟后再出现（S15-17）。
- 回忆成功只更新记忆状态，并最多把掌握档推到“已熟悉”；升到“已掌握”要靠做题证据。复习自评换算为证据强度的规则随 OQ-002 一并定稿。

## 每日上限与积压 <a id="daily-cap"></a>
- 每日复习不超过 plan.review.daily_cap 项；到期量超过上限时按考频乘遗忘风险取最要紧的一批，其余顺延，不显示积压数（S15-08、S06-24）。
- 每日新卡不超过 plan.review.new_card_daily_cap；调高新卡数时提示之后的复习量可能超过每日上限（S33-04）。

## 错题回炉 <a id="mistake-retry"></a>
- 回炉间隔依次取 practice.mistake.review_intervals；盲做后判对错并选把握度：做对进入下一档间隔，做错回到第一档（S19-04）。
- 间隔做对达到 practice.mistake.graduate_correct_count 次并做对一道变式题后毕业；没有可用变式时，所需次数增加 practice.mistake.no_variant_extra_count，且最后一次间隔取 practice.mistake.review_intervals 的末档（S19-05）。

## 引用的参数 <a id="params"></a>
learner.memory.target_retention、learner.memory.min_rating_seconds、plan.review.daily_cap、plan.review.new_card_daily_cap、practice.recall.relearn_delay_minutes、practice.mistake.review_intervals、practice.mistake.graduate_correct_count、practice.mistake.no_variant_extra_count。

## 验收方式 <a id="acceptance"></a>
- tests/models/srs/ 保存模拟数据：同一批复习序列下，候选算法在目标日保持率与每日负荷上的对比（探针 0.4B 的产物）。
- 性质测试：超过上限的项全部出现在后续日期，没有丢失。

## 补充引用的参数

- `learner.memory.min_cards_for_personal`：新卡少于该数量时用默认记忆参数
