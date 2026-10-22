// S03：两视图、三档宽度、七态、四考试和主要交互。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const entry = pageById("S03");
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S03.json");
const EXAMS = (readJson("fixtures/exams/index.json") as { exams: { key: string; exam_id: string }[] }).exams;
function copy(path: string, values: Readonly<Record<string, string | number>> = {}): string {
  let node: unknown = COPY;
  for (const key of path.split(".")) node = typeof node === "object" && node !== null ? (node as Record<string, unknown>)[key] : undefined;
  if (typeof node !== "string") throw new Error(`S03 缺少文案：${path}`);
  return node.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole: string, name: string) => (values[name] === undefined ? whole : String(values[name])));
}
async function press(target: Locator): Promise<void> {
  await target.press("Enter");
}
async function toast(page: Page, text: string): Promise<void> {
  await expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();
}

for (const width of [375, 834, 1280]) {
  for (const view of ["time", "res"]) {
    test(`S03 ${view} ${width} 宽：完整视图无横向溢出`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const watch = await watchPage(page);
      await watch.open(urlOf(entry, { view }));
      await expectOpened(
        page,
        entry,
        entry.views.find((item) => item.key === view),
      );
      await expectLoaded(page, entry);
      const main = page.locator("main#main");
      await expect(main.getByRole("heading", { name: copy(`${view}.title`), exact: true })).toBeVisible();
      if (view === "time") {
        if (width === 375) {
          await expect(main.getByTestId("mobile-time")).toBeVisible();
          await expect(main.getByTestId("weekly-grid")).toBeHidden();
        } else {
          await expect(main.getByTestId("weekly-grid")).toBeVisible();
          await expect(main.getByTestId("mobile-time")).toBeHidden();
        }
      }
      const content = await main.locator(".ui-cols__main").boundingBox();
      const aside = await main.locator(".ui-cols__aside").boundingBox();
      expect(content).not.toBeNull();
      expect(aside).not.toBeNull();
      if (content !== null && aside !== null) {
        if (width === 1280) expect(aside.x).toBeGreaterThanOrEqual(content.x + content.width - 1);
        else expect(aside.y).toBeGreaterThanOrEqual(content.y + content.height - 1);
      }
      await page.screenshot({ path: join(ROOT, ".test-results/S03", `${view}@${width}.png`), fullPage: true });
      const overflow = await main.evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      expectNoProblems(watch, "normal");
    });
  }
}

for (const view of ["time", "res"]) {
  test(`S03 ${view} 七态均可强制显示`, async ({ page }) => {
    test.setTimeout(60_000);
    const watch = await watchPage(page);
    for (const state of ABNORMAL_STATES) {
      await watch.open(urlOf(entry, { view, state }));
      await expectState(page, entry, state);
      const shown = page.locator(`main#main .ui-state--${state}`).first();
      if (state !== "loading" && state !== "error") await expect(shown).toContainText(copy(`state.${state}.title`));
      if (state === "empty") await expect(shown.getByRole("button", { name: copy("state.empty.action"), exact: true })).toBeVisible();
      if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
      if (state === "restricted") await expect(shown.getByRole("link")).toHaveAttribute("href", pageById("S11").path);
      expectNoProblems(watch, state);
    }
  });
}

test("S03 四考试有各自的资料示例，切换保持两种视图可用", async ({ page }) => {
  test.setTimeout(60_000);
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    for (const view of ["time", "res"]) {
      await watch.open(urlOf(entry, { view, exam: exam.key }));
      await expectLoaded(page, entry);
      if (view === "res") {
        const fixture = readJson(`fixtures/pages/S03/${exam.exam_id}.json`) as { materials: { title: string }[] };
        for (const material of fixture.materials) await expect(page.locator("main#main")).toContainText(material.title);
      }
      expectNoProblems(watch, "normal");
    }
  }
});

test("S03 时间：身份、时段、不可学日、每日时长与校准均能操作", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "time" }));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const identity = main.getByRole("radio", { name: copy("identity.student"), exact: true });
  await press(identity);
  await expect(identity).toHaveAttribute("aria-checked", "true");
  await toast(page, copy("soon.template"));
  const slotName = copy("time.edit", { day: copy("day.mon"), period: copy("period.morning") });
  await press(main.getByRole("button", { name: slotName, exact: true }));
  const editor = page.getByRole("dialog", { name: copy("time.edit_day", { day: copy("day.mon") }), exact: true });
  await editor.getByLabel(copy("time.duration"), { exact: true }).fill("45");
  await editor.getByLabel(copy("time.scenario"), { exact: true }).selectOption("deep");
  await press(editor.getByRole("button", { name: copy("action.save"), exact: true }));
  await expect(editor).toBeHidden();
  await expect(main.getByRole("button", { name: slotName, exact: true })).toContainText(copy("scenario.deep"));
  await toast(page, copy("soon.save"));
  await press(main.getByRole("button", { name: copy("time.add_unavailable"), exact: true }));
  const unavailable = page.getByRole("dialog", { name: copy("time.add_unavailable"), exact: true });
  await expect(unavailable.getByRole("button", { name: copy("action.save"), exact: true })).toBeDisabled();
  await unavailable.getByLabel(copy("time.date"), { exact: true }).fill("2026-10-27");
  await unavailable.getByLabel(copy("time.reason"), { exact: true }).fill(copy("identity.working"));
  await press(unavailable.getByRole("button", { name: copy("action.save"), exact: true }));
  await expect(unavailable).toBeHidden();
  await press(main.getByRole("button", { name: copy("time.daily"), exact: true }));
  const daily = page.getByRole("dialog", { name: copy("time.daily"), exact: true });
  await daily.getByLabel(copy("time.daily_label"), { exact: true }).fill("");
  await expect(daily.getByRole("button", { name: copy("action.save"), exact: true })).toBeDisabled();
  await daily.getByLabel(copy("time.daily_label"), { exact: true }).fill("80");
  await press(daily.getByRole("button", { name: copy("action.save"), exact: true }));
  await expect(daily).toBeHidden();
  for (const key of ["replan", "invest", "scope"]) {
    await press(main.getByRole("button", { name: copy(`time.${key}`), exact: true }));
    await toast(page, copy("soon.calibration"));
  }
  expectNoProblems(watch, "normal");
});

test("S03 资料：三接入方式解释与地图来源均需确认", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "res" }));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  await press(main.getByRole("button", { name: copy("res.add"), exact: true }));
  const adding = page.getByRole("dialog", { name: copy("res.add"), exact: true });
  for (const method of ["parsable", "mapped_only", "link_only"]) await expect(adding).toContainText(copy(`res.${method}_body`));
  await expect(adding.getByRole("link", { name: copy("res.manage"), exact: true })).toHaveAttribute("href", pageById("S11").path);
  await press(adding.getByRole("button", { name: copy("action.close"), exact: true }));
  await press(main.getByRole("button", { name: copy("res.edit"), exact: true }).first());
  const maps = page.getByRole("dialog", { name: copy("res.map_dialog"), exact: true });
  await maps.getByRole("radio", { name: copy("res.draft"), exact: true }).check();
  await maps.getByRole("checkbox", { name: copy("res.extension"), exact: true }).check();
  await press(maps.getByRole("button", { name: copy("action.confirm"), exact: true }));
  await toast(page, copy("soon.map"));
  expectNoProblems(watch, "normal");
});

test("S03 六种导入入口均链接到我的资料，并保留入口类型", async ({ page }) => {
  test.setTimeout(60_000);
  const watch = await watchPage(page);
  for (const method of ["file", "photo", "drive", "link", "isbn", "template"]) {
    await watch.open(urlOf(entry, { view: "res" }));
    await expectLoaded(page, entry);
    const target = page.locator("main#main").getByRole("link", { name: copy(`import.${method}`), exact: true });
    await expect(target).toHaveAttribute("href", `${pageById("S11").path}?import=${method}`);
    await press(target);
    await expect(page).toHaveURL(new RegExp(`${pageById("S11").path}\\?import=${method}$`));
    expectNoProblems(watch, "normal");
  }
});

test("S03 下一步切换资料，跳过先说明典型值，再进入摸底", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "time" }));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  await expect(main.getByRole("link", { name: copy("action.back"), exact: true })).toHaveAttribute("href", pageById("S02").path);
  await press(main.getByRole("button", { name: copy("action.next"), exact: true }));
  await expect(page).toHaveURL(/view=res/);
  await expect(main.getByRole("heading", { name: copy("res.title"), exact: true })).toBeVisible();
  await expect(main.getByRole("link", { name: copy("action.diagnosis"), exact: true })).toHaveAttribute("href", pageById("S04").path);
  await press(main.getByRole("button", { name: copy("action.back"), exact: true }));
  await press(main.getByRole("button", { name: copy("action.skip"), exact: true }));
  let skip = page.getByRole("dialog", { name: copy("skip.title"), exact: true });
  await expect(skip).toContainText(copy("skip.body"));
  await press(skip.getByRole("button", { name: copy("action.continue"), exact: true }));
  await expect(main).toContainText(copy("skip.notice"));
  await press(main.getByRole("button", { name: copy("action.skip"), exact: true }));
  skip = page.getByRole("dialog", { name: copy("skip.title"), exact: true });
  await press(skip.getByRole("link", { name: copy("action.continue"), exact: true }));
  await expect(page).toHaveURL(new RegExp(`${pageById("S04").path}$`));
});

test("S03 离线仍可保存每日时长草稿", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "time", state: "offline" }));
  await expectState(page, entry, "offline");
  await press(page.locator("main#main").getByRole("button", { name: copy("time.daily"), exact: true }));
  const daily = page.getByRole("dialog", { name: copy("time.daily"), exact: true });
  await daily.getByLabel(copy("time.daily_label"), { exact: true }).fill("75");
  await press(daily.getByRole("button", { name: copy("time.offline_save"), exact: true }));
  await toast(page, copy("time.saved"));
  expect(await page.evaluate(() => localStorage.getItem("S03.offline-draft"))).toBe("75");
  expectNoProblems(watch, "offline");
});
