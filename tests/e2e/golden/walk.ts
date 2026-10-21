// 黄金路径的执行（阶段 1：只走页面跳转）：每条路径手机 375、桌面 1280 各一遍，逐步打开该步的页面（带 ?exam=kj 与 ?view=），
// 核对能打开、加载完、没有浏览器报错。每条测试带“接后端后补断言”标注，列出阶段 2 要补的断言（见 paths.ts 的 later）。
// 由 tests/e2e/smoke/golden-paths.spec.ts 注册进冒烟入口：pnpm e2e:smoke 与 bk verify（web、full）都会跑到。
import { expect, test } from "@playwright/test";
import { pageById, urlOf, type PageEntry, type PageView } from "../support/catalog.ts";
import { expectLoaded, expectOpened, watchPage } from "../support/checks.ts";
import { GOLDEN_EXAM, GOLDEN_PATHS, GOLDEN_VIEWPORTS, type GoldenStep } from "./paths.ts";

export const LATER_ANNOTATION = "接后端后补断言";

interface ResolvedStep {
  readonly step: GoldenStep;
  readonly entry: PageEntry;
  readonly view: PageView | undefined;
  readonly url: string;
}

/** 把步骤对上页面清单：页 ID 与视图都要是登记过的，写错了在加载测试时就报出来。 */
function resolveStep(step: GoldenStep): ResolvedStep {
  const entry = pageById(step.page);
  const view = step.view === undefined ? entry.views[0] : entry.views.find((item) => item.key === step.view);
  if (step.view !== undefined && view === undefined) throw new Error(`黄金路径写了 ${step.page} 没有的视图 ${step.view}`);
  const query: Record<string, string> = { exam: GOLDEN_EXAM };
  if (step.view !== undefined) query["view"] = step.view;
  return { step, entry, view, url: urlOf(entry, query) };
}

export function defineGoldenPathTests(): void {
  test.describe("黄金路径（阶段 1：只走页面跳转）", () => {
    test.describe.configure({ timeout: 3 * 60_000 });
    for (const path of GOLDEN_PATHS) {
      const steps = path.steps.map(resolveStep);
      const annotation = path.later.map((description) => ({ type: LATER_ANNOTATION, description }));
      for (const viewport of GOLDEN_VIEWPORTS) {
        test(`${path.id} ${path.title}（${viewport.width}）`, { annotation }, async ({ page }) => {
          await page.setViewportSize(viewport);
          const watch = await watchPage(page);
          for (const [index, { step, entry, view, url }] of steps.entries()) {
            const where = `${entry.id} ${entry.name}${step.view === undefined ? "" : `（${step.view}）`}`;
            await test.step(`${index + 1}. ${where}：${step.action}`, async () => {
              // 接后端后补断言：这里改成在上一页真实点击 step.action 里的按钮，并核对这一步的结果
              await watch.open(url);
              await expectOpened(page, entry, view);
              await expectLoaded(page, entry);
              expect(watch.problems("normal"), `${where}：不应有浏览器报错`).toEqual([]);
            });
          }
        });
      }
    }
  });
}
