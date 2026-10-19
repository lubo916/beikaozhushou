---
id: CONT-02
status: draft
refs:
  schema: [exam_profiles, knowledge_maps, knowledge_points, questions, question_knowledge_points]
  inv: [INV-26]
open_questions:
  - id: OQ-CONT-02-1
    q: 种子文件除 JSON 外是否支持表格？
    default: 0 期只支持 JSON；表格导入在 5.6 随批量导入实现
---
# CONT-02 种子导入器与主考试、对照考试种子

## 1 目标与边界
一条命令导入种子考试：几章、约两百个知识点、几百道题，知识点列表能看到它们（分期规划 0.2e）。导入器同时载入对照考试，用来发现按考试写分支的代码。
不做：用户资料导入与解析（5.2）。

## 2 业务规则
- R1 导入器读取 fixtures/exams/<考试ID>/ 下的 profile.json、knowledge-map.json、questions.json 或同结构的正式种子目录。
- R2 按领域调用 exam、map、content 各自的导入接口写入，不直接写其他领域的表。
- R3 可重复执行：同一种子再次导入不产生重复记录；内容有变化的题目产生新版本。
- R4 导入前按 contracts/exam-profile.schema.json 校验画像；任一文件不合法时整批不写入，并列出全部错误。
- R5 导入完成后输出各类记录的新增、更新、未变数量。
- R6 默认导入主种子与对照考试两门；具体考试由 OQ-012 决定。

## 3 界面
无（命令行）。

## 4 数据
写入 exam_profiles、knowledge_maps、knowledge_points、questions、question_knowledge_points（经各 owner 领域的导入接口）。

## 5 AI 行为
无。

## 6 验收
- CONT-02-AC1 对四个演示考试执行导入，再执行一次，记录数不变，第二次输出全部为未变。
- CONT-02-AC2 修改一道题的答案后再导入，该题产生新版本。
- CONT-02-AC3 画像不合法时整批不写入，输出包含字段路径。
- CONT-02-AC4 导入主种子与对照考试后，两门考试的知识点都能在知识点列表中查到。

## 7 不变量与合规
INV-26：导入逻辑不按考试写分支，考试差异只来自种子数据。
