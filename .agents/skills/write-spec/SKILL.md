---
name: write-spec
description: "新建或修改功能规格，补齐 refs 与登记，状态保持 draft。Write or update a feature spec from the spec-mode task pack. 仅在用户明确调用时使用。"
metadata:
  invocation: manual
  args: "<功能ID>"
---

# 写功能规格

输入：调用消息中给出的功能 ID。没有给出就先问。

1. 读 docs/product/roadmap.yaml 中该 ID 的条目，以及 docs/product/phases.yaml 中它所属闭环的一句话演示、黄金路径与“本闭环不做”，以及承担本功能的切片的验收句（它们是 AC 的种子）。
2. 运行 `python scripts/spec_tool.py pack <ID> --spec-mode`，完整阅读输出的包文件。它以非零状态退出并提示页面待深化时停下，提示用户先用 refine-page 技能完成该页深化。
3. 按 docs/meta/doc-system.md 附录 B 的七节写 docs/domains/<领域>/features/<ID>.md：只写现状；默认值写参数名，不写数字；每条 R 和 AC 都可测，AC 编号为 <ID>-AC<n>；覆盖条目在规格中成为 R 或 AC；AI 部分写评测引用和阈值，不写成确定性断言。页面深化时已写入交互要点的，把它们定稿为 R 与 AC。
4. 规格需要的契约条目、参数、业务事件或数据类别不存在时，在对应登记中新增，并带 owner。属于重型通道的（跨领域契约、AI 场景或执行者权限、数据类别与合规、参数语义），提醒用户走 spec/<ID> 规格先行 PR。
5. 待定问题写进 front matter 的 open_questions，编号 OQ-<ID>-<n>，每条都给临时默认。
6. 运行 `python scripts/spec_tool.py check` 直到通过；正文不超过 6,000 字符。
7. 旧模块文档里有本功能的规则细节时，提醒用户用 triage-legacy 分拣，不直接引用旧文档。
8. 状态保持 draft，提示用户安排另一个工具用 review-spec 技能做冷启动复核。问题清零后由人改为 ready。
