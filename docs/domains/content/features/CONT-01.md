---
id: CONT-01
status: draft
refs:
  schema: [questions, question_knowledge_points]
  api: [getQuestion]
  permissions: [content.question.read]
  adr: [ADR-010]
---
# CONT-01 题目模型：作答形态与四级可信度

## 1 目标与边界
题目有统一的结构：九种作答形态、四级可信度、版本与分层解析，供练习、诊断、模考共用（分期规划 0.2b，ADR-010）。
不做：题库管理、导入与审核界面（5.6）。

## 2 业务规则
- R1 作答形态取 glossary 的九种之一；题型取考试画像的 question_types。
- R2 可信度四级：审定题、自有题、已确认的生成题、未确认的即时题。
- R3 修改题干、选项、答案或解析产生新版本；旧版本保留，供证据回溯。
- R4 解析分层保存：一句话结论、分步推导、知识点回链、资料定位；逐选项解析带陷阱类型（glossary 十二类）。
- R5 题目可关联多个知识点，并区分主要与次要关联。
- R6 揭晓前的读取不返回答案、解析与逐选项解析。

## 3 界面
无。

## 4 数据
表 questions、question_knowledge_points；接口 getQuestion，动作 content.question.read。

## 5 AI 行为
无。

## 6 验收
- CONT-01-AC1 四个演示考试的样题都能按九种作答形态之一存取。
- CONT-01-AC2 修改答案后产生新版本，按旧版本号仍能取回旧内容。
- CONT-01-AC3 揭晓前读取题目，响应中不含答案与解析字段。
- CONT-01-AC4 陷阱类型不在 glossary 十二类中的逐选项解析被拒绝。

## 7 不变量与合规
无。
