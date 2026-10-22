// S09 知识地图的冒烟测试（照 S10 样板页写）。
// 覆盖：三档宽度的布局与原型一致（桌面左右两栏；平板上下排、视图卡在前；手机先两数与“需要你注意”、默认大纲树），正文不横向溢出；
// 四个视图都能用 ?view= 打开、点标签时地址跟着变；七态用 ?state= 强制显示、文案按 bk spec；四个演示考试都能打开（数据结构那场性价比锁定）；
// 主要按钮都能点——跳到路由表里的页面，或提示“即将上线”。按钮用键盘触发（locator.press），不受右下角“问导师”浮标遮挡；
// 文案与演示数据从仓库文件读，不在测试里抄一份。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

interface IndexJson {
  readonly exams: readonly { readonly key: string; readonly exam_id: string }[];
}
interface MapJson {
  readonly chapters: readonly {
    readonly knowledge_point_count: number;
    readonly sample_points: readonly { readonly id: string; readonly name: string }[];
  }[];
}

const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S09.json");
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

/** 本页文案：按“a.b.c”取一条原文。 */
function raw(path: string): string {
  let node: unknown = COPY;
  for (const key of path.split(".")) node = typeof node === "object" && node !== null ? (node as Record<string, unknown>)[key] : undefined;
  if (typeof node !== "string") throw new Error(`S09.json 里没有文案 ${path}`);
  return node;
}

/** 本页文案，填好占位符。 */
function copy(path: string, values: Readonly<Record<string, string | number>> = {}): string {
  return raw(path).replace(PLACEHOLDER, (whole: string, name: string) => (values[name] === undefined ? whole : String(values[name])));
}

/** 带数字占位符的文案（数字来自接口）：占位符处匹配任意数字。 */
function named(path: string): RegExp {
  const escaped = raw(path).replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  return new RegExp(escaped.replace(PLACEHOLDER, "\\d+"));
}

const entry = pageById("S09");
const EXAMS = (readJson("fixtures/exams/index.json") as IndexJson).exams;
const mapOf = (examId: string): MapJson => readJson(`fixtures/exams/${examId}/knowledge-map.json`) as MapJson;
const totalOf = (examId: string): number => mapOf(examId).chapters.reduce((sum, chapter) => sum + chapter.knowledge_point_count, 0);
const KJ = "junior-accounting";
const VIEWS = ["grid", "tree", "graph", "list"] as const;

const main = (page: Page): Locator => page.locator("main#main");

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.first().boundingBox();
  if (box === null) throw new Error("元素没有显示出来，量不到位置");
  return box;
}

const WIDTHS = [
  { width: 375, height: 812, layout: "phone", text: "手机：先两数与“需要你注意”，再视图卡，默认大纲树" },
  { width: 834, height: 900, layout: "tablet", text: "平板：上下排，视图卡在前" },
  { width: 1280, height: 900, layout: "desktop", text: "桌面：左边视图卡，右边小卡" },
] as const;

for (const size of WIDTHS) {
  test(`S09 ${size.width} 宽：${size.text}，正文不横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry));
    await expectOpened(page, entry, undefined);
    await expectLoaded(page, entry);
    const views = await boxOf(main(page).locator(".s09-views"));
    const stats = await boxOf(main(page).locator(".s09-stats"));
    if (size.layout === "desktop") expect(stats.x, "右栏应在视图卡右边").toBeGreaterThanOrEqual(views.x + views.width - 1);
    if (size.layout === "tablet") expect(stats.y, "统计卡应排在视图卡下面").toBeGreaterThanOrEqual(views.y + views.height - 1);
    if (size.layout === "phone") expect(views.y, "手机上视图卡应排在两数下面").toBeGreaterThanOrEqual(stats.y + stats.height - 1);
    const defaultView = size.layout === "phone" ? "tree" : "grid";
    await expect(main(page).getByRole("tab", { name: copy(`views.${defaultView}`) })).toHaveAttribute("aria-selected", "true");
    const overflow = await main(page).evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow, "正文区不应横向溢出").toBeLessThanOrEqual(1);
    expectNoProblems(watch, "normal");
  });
}

// 每个视图独立加载，避免四次导航共用一个用例的时间预算。
for (const key of VIEWS) {
  test(`S09 视图 ${key} 能用 ?view= 打开`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const watch = await watchPage(page);
    const total = totalOf(KJ);
    await watch.open(urlOf(entry, { view: key }));
    await expectLoaded(page, entry);
    await expect(main(page).getByRole("tab", { name: copy(`views.${key}`) })).toHaveAttribute("aria-selected", "true");
    const panel = main(page).getByRole("tabpanel");
    if (key === "grid") await expect(panel.locator("button.s09-cell[data-point]")).toHaveCount(total);
    if (key === "tree") await expect(panel.getByRole("progressbar")).toHaveCount(mapOf(KJ).chapters.length);
    if (key === "graph") await expect(panel.getByRole("img", { name: copy("graph.label") })).toBeVisible();
    if (key === "list") await expect(panel.locator("tbody tr")).toHaveCount(total);
    expectNoProblems(watch, "normal", `${key}：`);
  });
}

test("S09 视图切换标签同步更新地址", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "list" }));
  await expectLoaded(page, entry);
  await main(page)
    .getByRole("tab", { name: copy("views.tree") })
    .press("Enter");
  await expect(page).toHaveURL(/[?&]view=tree/);
  await expect(main(page).getByRole("tab", { name: copy("views.tree") })).toHaveAttribute("aria-selected", "true");
  expectNoProblems(watch, "normal");
});

// 七态逐态保留原有校验，每次导航都有独立用例的时间预算。
for (const state of ABNORMAL_STATES) {
  test(`S09 状态 ${state} 能强制显示且文案符合规格`, async ({ page }) => {
    const watch = await watchPage(page);
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    expectNoProblems(watch, state);
    const shown = main(page).locator(`.ui-state--${state}`).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.title"));
      await expect(shown).toContainText(copy("state.empty.body"));
      await expect(shown.getByRole("link", { name: copy("state.empty.action") })).toHaveAttribute("href", "/materials");
      await expect(page.getByRole("heading", { level: 1, name: entry.name, exact: true }), "空态时页名照常").toBeVisible();
    }
    if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
    if (state === "restricted" || state === "insufficient_data") {
      await expect(shown).toContainText(copy(`state.${state}.body`));
      await expect(main(page).locator(".s09-views"), "只在顶上提示，地图照常显示").toBeVisible();
    }
  });
}

for (const exam of EXAMS) {
  test(`S09 演示考试 ${exam.key} 的格子数和体检锁定正确`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry, { exam: exam.key, view: "grid" }));
    await expectLoaded(page, entry);
    await expect(main(page).locator("button.s09-cell[data-point]"), exam.key).toHaveCount(totalOf(exam.exam_id));
    const lock = main(page).getByText(copy("grid.locked"));
    if (exam.key === "ds") await expect(lock).toBeVisible();
    else await expect(lock).toHaveCount(0);
    expectNoProblems(watch, "normal", `${exam.key}：`);
  });
}

test("S09 主要按钮都能点：跳到路由表里的页面，或提示“即将上线”", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "grid" }));
  await expectLoaded(page, entry);
  const m = main(page);
  const button = (name: string | RegExp, exact = false): Locator => m.getByRole("button", { name, exact }).first();
  const pressFor = async (target: Locator, toast: string): Promise<void> => {
    await target.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: toast }), `点了以后应提示：${toast}`).toBeVisible();
  };

  // 页头：补充诊断去摸底诊断；新建知识点、更多操作里的管理动作提示即将上线，“从大纲或教材生成”去我的资料
  await expect(m.getByRole("link", { name: copy("header.diagnose"), exact: true }).first()).toHaveAttribute("href", "/diagnosis");
  await pressFor(button(copy("header.new_point"), true), copy("soon.new_point"));
  await button(copy("header.more"), true).press("Enter");
  await expect(m.getByRole("link", { name: new RegExp(copy("more.generate")) })).toHaveAttribute("href", "/materials");
  await pressFor(button(new RegExp(copy("more.manage"))), copy("soon.manage"));

  // 着色：换到“性价比阶梯”，图例跟着换；筛选“未达标”，提示符合筛选的个数，清除后提示消失
  await button(copy("coloring.roi"), true).press("Enter");
  await expect(m.getByRole("list", { name: copy("legend.label") })).toContainText(copy("legend.roi_tier", { tier: "S" }));
  await button(copy("filter.unreached"), true).press("Enter");
  await expect(m.getByText(named("filter.result"))).toBeVisible();
  await pressFor(button(copy("filter.scope_add"), true), copy("soon.scope"));
  await button(copy("filter.clear"), true).press("Enter");
  await expect(m.getByText(named("filter.result"))).toHaveCount(0);

  // 点格子：选中的知识点换成它；去主页链到它的知识点主页，背一背去复习与卡片，加入今日、练一练提示即将上线
  const first = mapOf(KJ).chapters[0]?.sample_points[0];
  if (first === undefined) throw new Error("初级会计没有示例知识点");
  await m.locator(`button.s09-cell[data-point="${first.id}"]`).press("Enter");
  const focus = m.locator(".s09-focus");
  await expect(focus).toContainText(first.name);
  await expect(focus).toContainText(copy("focus.picked"));
  await expect(focus.getByRole("link", { name: copy("focus.open"), exact: true })).toHaveAttribute("href", `/kp/${first.id}`);
  await expect(focus.getByRole("link", { name: copy("focus.review"), exact: true })).toHaveAttribute("href", "/review");
  await pressFor(focus.getByRole("button", { name: copy("focus.add_today"), exact: true }), copy("soon.add_today"));
  await pressFor(focus.getByRole("button", { name: copy("focus.practice"), exact: true }), copy("soon.practice"));

  // 需要你注意：补充诊断、挂资料跳页面，去复核提示即将上线
  const attention = m.locator(".s09-attention");
  await expect(attention.getByRole("link", { name: copy("attention.insufficient_action") })).toHaveAttribute("href", "/diagnosis");
  await expect(attention.getByRole("link", { name: copy("attention.no_material_action") })).toHaveAttribute("href", "/materials");
  await pressFor(attention.getByRole("button", { name: copy("attention.pending_action") }), copy("soon.recheck"));

  // 关系图：采纳导师建议、一键采纳高置信、编辑关系都提示即将上线
  await m.getByRole("tab", { name: copy("views.graph") }).press("Enter");
  await pressFor(button(copy("graph.adopt"), true), copy("soon.adopt"));
  await pressFor(button(named("graph.adopt_high")), copy("soon.adopt_high"));
  await pressFor(button(copy("graph.edit"), true), copy("soon.relations"));

  // 列表：名字链到知识点主页
  await m.getByRole("tab", { name: copy("views.list") }).press("Enter");
  await expect(m.getByRole("link", { name: first.name, exact: true })).toHaveAttribute("href", `/kp/${first.id}`);
  expectNoProblems(watch, "normal");
});

test("S09 折叠当前选中章后，Tab 仍能进入下一章方格并用方向键移动", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(urlOf(entry, { view: "grid" }));
  await expectLoaded(page, entry);
  const m = main(page);
  await m.locator("button.s09-cell[data-point]").nth(2).press("Enter");
  const chapter = m.locator("button.s09-row__name").first();
  await chapter.press("Enter");
  await expect(chapter).toHaveAttribute("aria-expanded", "false");
  const tabStop = m.locator('button.s09-cell[data-point][tabindex="0"]');
  await expect(tabStop).toHaveCount(1);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(tabStop).toBeFocused();
  const previousId = await tabStop.getAttribute("data-point");
  await page.keyboard.press("ArrowRight");
  await expect(tabStop).toBeFocused();
  await expect(tabStop).not.toHaveAttribute("data-point", previousId ?? "");
});

test("S09 补充的演示格可以从去主页进入对应知识点详情", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "grid" }));
  await expectLoaded(page, entry);
  const cell = main(page).locator("button.s09-cell[data-point]").nth(2);
  const id = await cell.getAttribute("data-point");
  const label = await cell.getAttribute("aria-label");
  expect(id).toBeTruthy();
  expect(label).toBeTruthy();
  await cell.press("Enter");
  await main(page)
    .locator(".s09-focus")
    .getByRole("link", { name: copy("focus.open"), exact: true })
    .press("Enter");
  await expect(page).toHaveURL(new RegExp(`/kp/${id ?? ""}`));
  await expect
    .poll(async () => {
      const title = await main(page).getByRole("heading", { level: 1 }).textContent();
      return title !== null && title.trim() !== "" && label?.startsWith(title) === true;
    })
    .toBe(true);
  await expect(main(page).locator(".ui-state--error")).toHaveCount(0);
  expectNoProblems(watch, "normal");
});
