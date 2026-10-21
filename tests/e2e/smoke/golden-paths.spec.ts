// 黄金路径（F06 验收 3）挂在冒烟入口下：pnpm e2e:smoke 只跑 tests/e2e/smoke，bk verify 的 web、full 两档都经它跑到黄金路径。
// 路径、步骤与“接后端后补断言”的清单在 tests/e2e/golden/（规则卡定稿后锁定）。
import { defineGoldenPathTests } from "../golden/walk.ts";

defineGoldenPathTests();
