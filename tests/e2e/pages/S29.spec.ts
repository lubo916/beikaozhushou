// S29：三档布局、七态、三个本页视图、四考试与主要动作。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator } from "@playwright/test";
import { pathTo } from "../../../apps/learner/src/routes.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";
interface PageFixture {
  sample_query: string;
  aliases: string[];
  point_id: string;
  material_id: string;
  quick_tables: { id: string; title: string; rows: { label: string; value: string; point_id: string }[] }[];
}
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S29.json");
const EXAMS = (readJson("fixtures/exams/index.json") as { exams: { key: string; exam_id: string }[] }).exams;
const entry = pageById("S29");
const fixtureOf = (examId: string): PageFixture => readJson(`fixtures/pages/S29/${examId}.json`) as PageFixture;
function copy(path: string, values: Record<string, string> = {}): string {
  let node: unknown = COPY;
  for (const key of path.split(".")) node = typeof node === "object" && node !== null ? (node as Record<string, unknown>)[key] : undefined;
  if (typeof node !== "string") throw new Error(`S29 copy missing: ${path}`);
  return node.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole: string, key: string) => values[key] ?? whole);
}
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("S29 element has no visible box");
  return box;
}
for (const width of [375, 834, 1280]) {
  test(`S29 ${width}：布局按容器切换，正文不横向溢出`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry));
    await expectOpened(page, entry, undefined);
    await expectLoaded(page, entry);
    const main = await boxOf(page.locator("main#main .ui-cols__main"));
    const aside = await boxOf(page.locator("main#main .ui-cols__aside"));
    if (width === 1280) expect(aside.x).toBeGreaterThanOrEqual(main.x + main.width - 1);
    else expect(aside.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
    const overflow = await page.locator("main#main").evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expectNoProblems(watch, "normal");
    await page.screenshot({ path: testInfo.outputPath(`S29-${width}.png`), fullPage: true });
  });
}

test("S29 七态都有原型文案与可行的出口", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    if (state !== "loading") await expect(shown).toContainText(copy(`state.${state}.body`));
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.title"));
      await shown.getByRole("button", { name: copy("state.empty.action") }).press("Enter");
      await expect(page.getByRole("searchbox", { name: copy("search.label") })).toBeFocused();
      await expect(page.getByRole("heading", { name: copy("recent.title"), exact: true })).toBeVisible();
    }
    if (state === "offline") await expect(shown.getByRole("link")).toHaveAttribute("href", pathTo("S14"));
    if (state === "restricted") {
      await expect(shown.getByRole("link")).toHaveAttribute("href", pathTo("S31"));
      await page
        .locator("main#main")
        .getByRole("button", { name: copy("search.photo"), exact: true })
        .press("Enter");
      const dialog = page.getByRole("dialog", { name: copy("photo.title") });
      await dialog.getByRole("radio", { name: copy("photo.practice"), exact: true }).check();
      await expect(dialog.getByRole("button", { name: copy("photo.continue") })).toBeDisabled();
      await dialog.getByRole("button", { name: copy("photo.cancel"), exact: true }).press("Enter");
    }
    if (state === "insufficient_data")
      await expect(shown.getByRole("link", { name: copy("state.insufficient_data.action") })).toHaveAttribute("href", pathTo("S28"));
    expectNoProblems(watch, state);
  }
});

test("S29 搜索结果、最近访问和速查表都可直接用 view 打开", async ({ page }) => {
  const watch = await watchPage(page);
  for (const view of ["results", "recent", "quick"]) {
    await watch.open(urlOf(entry, { view }));
    await expectOpened(page, entry, undefined);
    await expect(page.getByRole("radio", { name: copy(`views.${view}`), exact: true })).toHaveAttribute("aria-checked", "true");
    if (view === "recent") {
      await expectState(page, entry, "empty");
      await expect(page.getByRole("heading", { name: copy("recent.title"), exact: true })).toBeVisible();
    } else {
      await expectLoaded(page, entry);
      await expect(
        page.getByRole("heading", { name: copy(view === "results" ? "results.title" : "quick.title"), exact: true }),
      ).toBeVisible();
    }
    expectNoProblems(watch, "normal");
  }
});

test("S29 四个演示考试各有自己的检索结果和速查表", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    const fixture = fixtureOf(exam.exam_id);
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectLoaded(page, entry);
    await expect(page.getByRole("searchbox", { name: copy("search.label") })).toHaveValue(fixture.sample_query);
    await expect(page.locator("main#main .s29-results a").first()).toHaveAttribute("href", pathTo("S10", { kpId: fixture.point_id }));
    await expect(page.getByRole("table")).toContainText(fixture.quick_tables[0]?.rows[0]?.value ?? "");
    await expect(page.getByRole("heading", { name: fixture.quick_tables[0]?.title ?? "", exact: true })).toBeVisible();
    expectNoProblems(watch, "normal", exam.key);
  }
});

test("S29 可搜索、筛选、查表、回到资料，并在拍照前选择用途", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const fixture = fixtureOf("junior-accounting");
  const input = page.getByRole("searchbox", { name: copy("search.label") });
  await page.keyboard.press("Control+k");
  await expect(input).toBeFocused();
  await input.fill(fixture.aliases[1] ?? fixture.sample_query);
  await main.getByRole("button", { name: copy("search.submit"), exact: true }).press("Enter");
  await expect(page).toHaveURL(new RegExp(`q=${fixture.aliases[1] ?? fixture.sample_query}`));
  await expect(main.locator(".s29-results > section")).toHaveCount(6);
  await main.getByRole("button", { name: copy("kind.material"), exact: true }).press("Enter");
  await expect(main.locator(".s29-results > section")).toHaveCount(1);
  await expect(main.locator(".s29-results a")).toHaveAttribute("href", pathTo("S12", { docId: fixture.material_id }));
  await main.getByRole("button", { name: copy("kind.all"), exact: true }).press("Enter");
  await expect(main.locator(".s29-results > section")).toHaveCount(6);
  for (const action of ["add", "card", "note"]) {
    await main
      .getByRole("button", { name: copy(`results.${action}`), exact: true })
      .first()
      .press("Enter");
    await expect(page.getByRole("status").filter({ hasText: copy("soon.action", { action: copy(`results.${action}`) }) })).toBeVisible();
  }
  for (const table of fixture.quick_tables) {
    await page.getByRole("combobox", { name: copy("quick.choose") }).selectOption(table.id);
    await expect(page.getByRole("heading", { name: table.title, exact: true })).toBeVisible();
    await expect(page.getByRole("table")).toContainText(table.rows[0]?.value ?? "");
  }
  // 速查表由对应类型的知识点汇成，一张表有多行；每行“查看知识点”的链接名带上条目名（读屏能分清）。
  // 回到和关键词相关的那张表（第一张），示例知识点那一行能回到它的知识点主页。
  const related = fixture.quick_tables[0];
  const sampleRow = related?.rows.find((row) => row.point_id === fixture.point_id);
  if (related === undefined || sampleRow === undefined) throw new Error("S29 相关速查表里没有示例知识点");
  await page.getByRole("combobox", { name: copy("quick.choose") }).selectOption(related.id);
  await expect(main.getByRole("link", { name: copy("quick.point_named", { name: sampleRow.label }), exact: true })).toHaveAttribute(
    "href",
    pathTo("S10", { kpId: fixture.point_id }),
  );
  await main.getByRole("button", { name: copy("search.photo"), exact: true }).press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("photo.title") });
  await expect(dialog).toBeVisible();
  const proceed = dialog.getByRole("button", { name: copy("photo.continue"), exact: true });
  await expect(proceed).toBeDisabled();
  await dialog.getByRole("radio", { name: copy("photo.explain"), exact: true }).check();
  await expect(proceed).toBeEnabled();
  await proceed.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: copy("soon.photo") })).toBeVisible();
  await main.getByRole("button", { name: copy("search.clear"), exact: true }).press("Enter");
  await expectState(page, entry, "empty");
  await input.fill("__no_s29_matching_content__");
  await main.getByRole("button", { name: copy("search.submit"), exact: true }).press("Enter");
  await expectState(page, entry, "insufficient_data");
  await main.getByRole("button", { name: copy("state.insufficient_data.feedback"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("soon.feedback") })).toBeVisible();
  expectNoProblems(watch, "normal");
});
