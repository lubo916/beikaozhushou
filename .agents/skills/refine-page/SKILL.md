---
name: refine-page
description: "页面深化：把深化来源原型中对应页的交互转写进页面登记与功能规格草稿。Refine a page from the deep-source prototype into registry and spec drafts. 仅在用户明确调用时使用。"
metadata:
  invocation: manual
  args: "<页ID>"
---

# 页面深化

输入：调用消息中给出的目标页 ID，例如 S18。在 refine/<页ID> 分支上进行。没有给出就先问。

1. 读 scripts/spec_tool.toml 中 [deep_source] 指向的深化来源原型，以及深化清单中该页的一行；再读该页现有登记 design/screens/<端>/<页ID>.yaml。
2. 对照列出：要新增的能力、视图、布局要点、状态例外、AI 职责、各条目的交互要点，以及与单一事实源（docs/meta/doc-system.md 第 3 章）冲突之处。
3. 冲突逐条交用户裁决，裁决前不写入。界面与交互以深化来源为准；业务口径、数据定义、商业规则以单一事实源为准。用户采纳深化来源做法的，提醒按重型通道修改单一事实源。
4. 修改页面登记（原型已冻结，见 ADR-001）：新条目只在 items 末尾追加，不写 id；子面板与弹层做成 views；运行 `python scripts/spec_tool.py import-prototype --write-ids` 分配编号，确认差异只落在该页；最后把该页的 refine 改为 refined。
5. 新条目分配到功能：改 docs/product/roadmap.yaml 中相应功能的 covers；需要新功能时，请用户在主干运行 `python scripts/spec_tool.py new feature …`。
6. 交互要点写进覆盖该条目的功能规格草稿；规格不存在就按附录 B 建为 draft。只写行为，数值写“由参数决定”，不写深化来源的编号、章节号与产品名（E-REFINE-03）。
7. 运行 `python scripts/spec_tool.py check` 直到通过，提示安排写规格。
