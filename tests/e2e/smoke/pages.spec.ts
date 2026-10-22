// 全部页面冒烟（F06 验收 1）：三端 70 页逐页打开默认视图与各视图，七态都用 ?state= 强制显示一遍（假数据模式）。
// 每一步都不许有浏览器报错（未捕获的异常、控制台 error）；只放过出错、离线、受限三态下假数据层故意制造的接口失败。
// 每个视图、状态单独一个测试，使用 Playwright 自带的 page/context 隔离，不让 Service Worker、挂起请求和迟到错误跨场景。
import { expect, test, type Page } from "@playwright/test";
import { ALL_PAGES, PAGES_MD_IDS, pageLabel, urlOf, type PageEntry } from "../support/catalog.ts";
import {
  ABNORMAL_STATES,
  STATE_NAMES,
  expectLoaded,
  expectNoProblems,
  expectOpened,
  expectState,
  watchPage,
  type PageWatch,
  type StateCode,
} from "../support/checks.ts";

test("页面清单与 docs/baseline/pages.md 一致：三端 70 页都在冒烟范围里", () => {
  expect(ALL_PAGES.map((entry) => entry.id)).toEqual(PAGES_MD_IDS);
});

function definePageSmoke(entry: PageEntry): void {
  const check = (title: string, state: StateCode, body: (page: Page, watch: PageWatch) => Promise<void>): void => {
    test(`${pageLabel(entry)}：${title}`, async ({ page }) => {
      const watch = await watchPage(page);
      // 不捕获首错：失败直接归属当前场景，保留完整堆栈和 trace，由内置 fixture 清理。
      await body(page, watch);
      await page.close();
      // 成功场景关闭时仍复核迟到错误；页面与 Worker 随本场景的独立 Context 一起释放。
      expectNoProblems(watch, state, "关闭页面后：");
    });
  };

  check("正常态（默认视图）", "normal", async (page, watch) => {
    await watch.open(urlOf(entry));
    await expectOpened(page, entry, entry.views[0]);
    await expectLoaded(page, entry);
    expectNoProblems(watch, "normal");
  });
  for (const view of entry.views.slice(1)) {
    check(`视图 ?view=${view.key}`, "normal", async (page, watch) => {
      await watch.open(urlOf(entry, { view: view.key }));
      await expectOpened(page, entry, view);
      await expectLoaded(page, entry);
      expectNoProblems(watch, "normal");
    });
  }
  for (const state of ABNORMAL_STATES) {
    check(`${STATE_NAMES[state]}态 ?state=${state}`, state, async (page, watch) => {
      await watch.open(urlOf(entry, { state }));
      await expectState(page, entry, state);
      expectNoProblems(watch, state);
    });
  }
}

for (const entry of ALL_PAGES) definePageSmoke(entry);
