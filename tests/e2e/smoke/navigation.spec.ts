/// <reference lib="dom" />
// F06 本地复核：真实学员页面连续导航时，正文应就绪，假数据层应持续控制页面，且没有浏览器报错。
// 导航记录用于定位 Service Worker 重新注册或页面刷新；断言只检查可用行为，不限定导航实现。
import { expect, test, type Frame } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { expectLoaded, expectNoProblems, expectOpened, watchPage } from "../support/checks.ts";

const STEPS = ["S06", "S22", "S23", "S07", "S06"].map(pageById);

test("真实学员页面连续导航：五步均就绪且由假数据层控制", async ({ page }) => {
  // 整条路径沿用黄金路径的总时限；每一步继续使用共用检查的默认就绪上限，不增加等待。
  test.setTimeout(3 * 60_000);
  const watch = await watchPage(page);
  const navigations: string[] = [];
  const onNavigated = (frame: Frame): void => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  };
  page.on("framenavigated", onNavigated);
  try {
    for (const [index, entry] of STEPS.entries()) {
      await test.step(`${index + 1}. ${entry.id} ${entry.name}`, async () => {
        await watch.open(urlOf(entry, { exam: "kj" }));
        await expectOpened(page, entry, entry.views[0]);
        await expectLoaded(page, entry);
        expect(await page.evaluate(() => navigator.serviceWorker.controller !== null), `${entry.id}：假数据层应控制当前页面`).toBe(true);
        expectNoProblems(watch, "normal", `${entry.id}：`);
      });
    }
  } finally {
    page.off("framenavigated", onNavigated);
    test.info().annotations.push({ type: "主框架导航诊断", description: `${navigations.length} 次：${navigations.join(" → ")}` });
  }
});
