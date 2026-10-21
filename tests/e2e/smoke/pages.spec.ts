// 全部页面冒烟（F06 验收 1）：三端 70 页逐页打开默认视图与各视图，七态都用 ?state= 强制显示一遍（假数据模式）。
// 每一步都不许有浏览器报错（未捕获的异常、控制台 error）；只放过出错、离线、受限三态下假数据层故意制造的接口失败。
// 一页一个测试；某一步没过，记下来接着查下一步，最后一起报，方便一次看全这一页哪里坏了。
import { expect, test } from "@playwright/test";
import { ALL_PAGES, PAGES_MD_IDS, pageLabel, urlOf, type PageEntry } from "../support/catalog.ts";
import {
  ABNORMAL_STATES,
  STATE_NAMES,
  expectLoaded,
  expectNoProblems,
  expectOpened,
  expectState,
  firstLine,
  watchPage,
} from "../support/checks.ts";

test.describe.configure({ timeout: 5 * 60_000 });

test("页面清单与 docs/baseline/pages.md 一致：三端 70 页都在冒烟范围里", () => {
  expect(ALL_PAGES.map((entry) => entry.id)).toEqual(PAGES_MD_IDS);
});

function definePageSmoke(entry: PageEntry): void {
  test(`${pageLabel(entry)}：能打开、没有报错、七态都能显示`, async ({ page }) => {
    const watch = await watchPage(page);
    const failures: string[] = [];
    const check = async (title: string, body: () => Promise<void>): Promise<void> => {
      try {
        await test.step(title, body);
      } catch (error) {
        failures.push(`${title}：${firstLine(error)}`);
      }
    };

    await check("正常态（默认视图）", async () => {
      await watch.open(urlOf(entry));
      await expectOpened(page, entry, entry.views[0]);
      await expectLoaded(page, entry);
      expectNoProblems(watch, "normal");
    });
    for (const view of entry.views.slice(1)) {
      await check(`视图 ?view=${view.key}`, async () => {
        await watch.open(urlOf(entry, { view: view.key }));
        await expectOpened(page, entry, view);
        await expectLoaded(page, entry);
        expectNoProblems(watch, "normal");
      });
    }
    for (const state of ABNORMAL_STATES) {
      await check(`${STATE_NAMES[state]}态 ?state=${state}`, async () => {
        await watch.open(urlOf(entry, { state }));
        await expectState(page, entry, state);
        expectNoProblems(watch, state);
      });
    }

    expect(failures, `${pageLabel(entry)} 没通过的检查`).toEqual([]);
  });
}

for (const entry of ALL_PAGES) definePageSmoke(entry);
