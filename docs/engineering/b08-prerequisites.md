# B08 开工前置检测

B08 除任务依赖和 R05 定稿外，还有两个必须独立完成的衔接：

- `R01-diagnosis-evidence`：R01 补充诊断错答不记负证据，写明与 R05 的衔接并补例子。
- `R06-option-forecast`：R06 补充各档方案投入对应的到目标日预测规则和例子。

当前两项都没有履行凭据，B08 不可启动。旧任务 done、规则卡旧的已定稿状态不能替代它们。检查覆盖 status 推荐、pack、start（包括网页端、恢复、from-failed）、done、收包和最终合并；`--force` 不能跳过。

## 查看

本地：`pwsh -File .\bk-v4.ps1 prereq B08`。未完成时返回非零并逐项说明原因。`status` 也会显示原因。

## 衔接完成后登记

1. 按既有授权完成相应规则卡与例子；需要新的业务选择时先请负责人确认。
2. 卡片与例子重新定稿，整合确认决定卡写在 `docs/decisions/`，Codex 的衔接复核报告写在 `progress/reports/`，全部提交主干。
3. 复核确实覆盖本次衔接后，在干净主干登记（不是仅检查文件存在）：

```powershell
pwsh -File .\bk-v4.ps1 prereq B08 --accept R01-diagnosis-evidence --decision docs/decisions/<整合确认>.md --review progress/reports/<衔接复核>.md --case <例子编号>
pwsh -File .\bk-v4.ps1 prereq B08 --accept R06-option-forecast --decision docs/decisions/<整合确认>.md --review progress/reports/<衔接复核>.md --case <例子编号>
```

`--case` 可重复指定。登记仅在本地进行，并提交 `tools/bk.prerequisites.json`。该文件只由前置登记流程维护，不由页面或后端任务直接修改。

工具要求卡片和例子的业务内容都比安装闸门时发生变化；只改定稿标签不能放行。凭据绑定规则卡、例子、确认决定和复核报告的 SHA256，且引用的例子必须存在。任一文件后来改变，凭据自动失效，需重新复核登记。

开工凭据必须已提交到 `main`；当前分支或入包候选中的检查工具、凭据及所绑定依据均须与主干一致，不能自行改记录放行。

配置缺失、损坏或删掉必需项均按未满足处理。任务包会携带工具和凭据；包内直接 start 仍会复查。只有两项均有效后才通过额外检测；原有 B07、页面任务等依赖仍须满足。

SHA256 用于防止过时复核被继续使用，不能代替人对业务规则和例子是否正确的复核。不得仅为了启动 B08 登记一张未实际完成衔接的凭据。
