# F03 第3轮：工程接线授权

- 背景：七项命令虽通过，生成接入、术语 lint、真实 gallery 与脚本类型检查仍有缺口，未登记完成。
- 决定：用户选择 A，授权补齐根 package.json、.gitignore、packages/codegen 对应目标及测试、packages/ui 脚本类型配置、tests 下 gallery/集成测试及 tech.md 说明。
- 生成物：链路可重建后，将两个 UI 令牌文件和词汇生成文件退索引，保留本地生成结果。
- 边界：不新增依赖、不改业务逻辑、不扩大 tools/AGENTS 修改范围；此前两处最小修复授权保持原范围。
- 影响：补齐后再完整复验并核对 F03 验收，全部满足后才登记、合并和同步 GitHub。
