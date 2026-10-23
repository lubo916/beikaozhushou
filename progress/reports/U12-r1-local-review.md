# U12 第 1 轮本地复核

结果包：bk-v0028-U12-r1-done.zip；基线 098f2474e00ff57f5f6d6f667fa38c660b0f3955；结果提交 eb0768a8ca70e53000d7ddc102d95250ce4af62b。V4 身份与授权范围检查通过；本轮代码未合入主干。

## 已确认的问题

1. 格式检查失败：14 个 S12 授权范围内文件不符合 Prettier 格式；修复后还须继续完成 ESLint 检查。
2. 类型检查失败：10 处 i18next 插值把已格式化的字符串放入保留的 count 参数，触发 TS2345。可为显示文本改用 countText 等插值名并同步文案，避免强行转换展示字符串。涉及 ChapterGuide、ExplainTab、LinksTabs、MoreSettings、NotesTab、PaperPagePanel、QuizCard、Reader。
3. 重叠标注静默失效（代码复核）：annotations.ts:18-21 跳过重叠记录，Reader.tsx:205-210 仍记入新增与撤销历史并显示语义栏。复现：kj-p2 第 18-22 字已有高亮，再选同一段点挖空，切到挖空模式后不会遮挡。应处理叠加或明确提示不支持，不能显示假成功。
4. 切知识点后仍带旧选文（代码复核）：Reader.tsx:169-176 只换知识点，213-216 设置的 quoted 未清理，260 传到新 PointPanel。复现：第一段选文点讲一下，再点第二段知识点标签，侧栏知识点已换而引用仍是第一段。应按知识点绑定或清空引用。

交互问题须先补能复现失败的回归测试再修；不删测试、不跳过测试。原有重叠测试若需纠正，应说明原断言与用户可见行为的差异，并按 bk 的测试变更规则处理。

## 本地检查记录

第一次 full 的 lint 与 typecheck 失败；540 项单元测试、71 项工具测试、构建、7 项数据库测试通过。三种浏览器的 S12 七态冒烟已通过，但整仓冒烟在收尾前被执行环境中断；本次 gallery 尚未运行。此前 .bk/last-verify.json 的通过记录来自更早一轮，不能用于 U12 放行。正在通过官方收包流程重跑并保留新结果。

## 用户决定

浮标采用 A，见决定卡；属于后续整合任务，不扩大 U12 修改范围。第 2 轮正式交接单应携带下列 answers。

```json
{
  "task": "U12",
  "round": 1,
  "result": "needs_fix",
  "answers": {
    "U12-Q1": "A"
  },
  "decisions": [
    "docs/decisions/D-2026-10-23-U12-mentor-entry.md"
  ]
}
```
