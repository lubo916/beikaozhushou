---
applies_to: ["contracts/openapi.yaml", "packages/domains/**/api/**", "apps/**/api/**"]
---
# 接口约定

## 规则
1. operationId 用 camelCase 动宾结构，全局唯一，并用 x-owner 写明所属领域。
2. 写操作接受请求头 Idempotency-Key；同一键的重复请求返回第一次的结果，不产生第二条记录。
3. 错误响应统一为 {code, message_key, details}，code 取自 contracts/errors.yaml。
4. 时间字段用带时区的 ISO 8601（UTC）；目标日、计划日等日期字段用 YYYY-MM-DD，按学员时区解释。
5. 列表接口用游标分页（cursor、limit），limit 不超过参数 api.page.max_limit。

## 示例
- 正例：`submitAnswer`（x-owner: practice），POST /practice/answers，带 Idempotency-Key；揭晓后再提交返回 PRAC_REVEAL_LOCKED。
- 反例：`/api/v1/doSubmit` 返回 `{"error": "答案已锁定"}`：动词不清、没有 owner、错误是自由文本。

## 理由
弱网下的重复提交最常见于做题与复习，没有幂等键会写出两条证据，掌握档随之虚高。统一错误码让学员端、机构端、后台共用一套文案键，也让 AI 生成的代码有据可依。
