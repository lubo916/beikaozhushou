// S10 知识点主页的冒烟测试（F08 样板页：页面任务的端到端测试照这里写）。
// 覆盖：三档宽度的布局与原型一致（桌面左右两栏，平板与手机单栏，正文不横向溢出）；本页没有多视图；七态用 ?state= 强制显示、文案按 bk spec；
// 四个演示考试都能打开示范知识点；主要按钮都能点——跳到路由表里的页面，或提示“即将上线”。
// 按钮用键盘触发（locator.press），不受右下角“问导师”浮标遮挡；文案与演示数据从仓库文件读，不在测试里抄一份。
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
  readonly chapters: readonly { readonly sample_points: readonly { readonly id: string; readonly name: string }[] }[];
}
interface PointJson {
  readonly materials?: readonly { readonly id: string; readonly title: string; readonly access: string }[];
  readonly relations?: readonly { readonly type: string; readonly items: readonly { readonly point_id?: string; readonly name: string }[] }[];
}
interface PageJson {
  readonly demo_point_id: string;
  readonly points: Readonly<Record<string, PointJson>>;
}

const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S10.json");
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

/** 本页文案：按“a.b.c”取一条原文。 */
function raw(path: string): string {
  let node: unknown = COPY;
  for (const key of path.split(".")) node = typeof node === "object" && node !== null ? (node as Record<string, unknown>)[key] : undefined;
  if (typeof node !== "string") throw new Error(`S10.json 里没有文案 ${path}`);
  return node;
}

/** 本页文案，填好占位符。 */
function copy(path: string, values: Readonly<Record<string, string | number>> = {}): string {
  return raw(path).replace(PLACEHOLDER, (whole: string, name: string) => (values[name] === undefined ? whole : String(values[name])));
}

/** 带数字占位符的按钮名（数字来自接口或参数）：占位符处匹配任意数字。 */
function named(path: string): RegExp {
  const escaped = raw(path).replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  return new RegExp(escaped.replace(PLACEHOLDER, "\\d+"));
}

function demoOf(examId: string): { readonly id: string; readonly name: string; readonly extra: PointJson } {
  const page = readJson(`fixtures/pages/S10/${examId}.json`) as PageJson;
  const map = readJson(`fixtures/exams/${examId}/knowledge-map.json`) as MapJson;
  const point = map.chapters.flatMap((chapter) => chapter.sample_points).find((p) => p.id === page.demo_point_id);
  if (point === undefined) throw new Error(`${examId} 的示范知识点不在地图里`);
  return { ...point, extra: page.points[point.id] ?? {} };
}

const entry = pageById("S10");
const EXAMS = (readJson("fixtures/exams/index.json") as IndexJson).exams;
const KJ = demoOf("junior-accounting");

function title(page: Page, name: string): Locator {
  return page.getByRole("heading", { level: 1, name, exact: true });
}

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.first().boundingBox();
  if (box === null) throw new Error("元素没有显示出来，量不到位置");
  return box;
}

const WIDTHS = [
  { width: 375, height: 812, split: false },
  { width: 834, height: 900, split: false },
  { width: 1280, height: 900, split: true },
] as const;

for (const size of WIDTHS) {
  test(`S10 ${size.width} 宽：${size.split ? "左右两栏" : "单栏，右栏的卡片排在下面"}，正文不横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry));
    await expectOpened(page, entry, undefined);
    await expectLoaded(page, entry);
    await expect(title(page, KJ.name)).toBeVisible();
    const main = await boxOf(page.locator("main#main .ui-cols__main"));
    const aside = await boxOf(page.locator("main#main .ui-cols__aside"));
    if (size.split) expect(aside.x, "右栏应在主栏右边").toBeGreaterThanOrEqual(main.x + main.width - 1);
    else expect(aside.y, "右栏应排在主栏下面").toBeGreaterThanOrEqual(main.y + main.height - 1);
    const overflow = await page.locator("main#main").evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow, "正文区不应横向溢出").toBeLessThanOrEqual(1);
    expectNoProblems(watch, "normal");
  });
}

test("S10 本页没有多视图（页面登记里没有视图，?view= 无须切换）", () => {
  expect(entry.views).toEqual([]);
});

test("S10 七态都能用 ?state= 强制显示，文案按 bk spec", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    expectNoProblems(watch, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.title"));
      await expect(shown).toContainText(copy("state.empty.body"));
      await expect(shown.getByRole("link", { name: copy("state.empty.action") })).toHaveAttribute("href", "/materials");
      await expect(title(page, KJ.name), "空态时页头照常").toBeVisible();
    }
    if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
    if (state === "restricted") {
      await expect(shown).toContainText(copy("profile.cold.body"));
      await expect(title(page, KJ.name), "受限只落在考点档案，其余照常").toBeVisible();
    }
    if (state === "insufficient_data") {
      await expect(shown).toContainText(copy("profile.maturing.body"));
      await expect(page.locator("main#main .ui-pagehead")).toContainText(named("header.exam_level_estimated"));
    }
  }
});

test("S10 四个演示考试切过去，都能打开各自的示范知识点", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    const demo = demoOf(exam.exam_id);
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectLoaded(page, entry);
    await expect(title(page, demo.name), `${exam.key} 的示范知识点`).toBeVisible();
    expectNoProblems(watch, "normal", `${exam.key}：`);
  }
});

test("S10 主要按钮都能点：跳到路由表里的页面，或提示“即将上线”", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const button = (name: string | RegExp, exact = false): Locator => main.getByRole("button", { name, exact }).first();
  const pressFor = async (target: Locator, toast: string): Promise<void> => {
    await target.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: toast }), `点了以后应提示：${toast}`).toBeVisible();
  };

  // 页头：攻坚包、加入今日（先看估算）、范围开关、星标、改重要度
  await pressFor(button(named("header.attack_pack")), copy("soon.attack_pack"));
  await button(copy("header.add_today"), true).press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("add_today.title") });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(named("add_today.estimate"));
  await dialog.getByRole("button", { name: copy("add_today.cancel"), exact: true }).press("Enter");
  await expect(dialog).toBeHidden();
  await pressFor(button(copy("header.scope_remove"), true), copy("soon.scope"));
  await pressFor(button(copy("header.star"), true), copy("soon.star"));
  await pressFor(button(copy("header.importance_change"), true), copy("soon.importance"));

  // 掌握阶梯：去验证（题数是参数）、改目标档
  await pressFor(button(named("ladder.verify")), copy("soon.verify"));
  await pressFor(button(copy("ladder.change_target"), true), copy("soon.target"));

  // 建议学法：学去阅读器、记去复习与卡片，练提示即将上线
  const reader = KJ.extra.materials?.find((spot) => spot.access === "parsable");
  if (reader === undefined) throw new Error("示范知识点没有可解析的资料");
  await expect(main.getByRole("link", { name: copy("methods.procedure.learn") })).toHaveAttribute("href", `/reader/${reader.id}`);
  await expect(main.getByRole("link", { name: copy("methods.procedure.memorize") })).toHaveAttribute("href", "/review");
  await pressFor(button(copy("methods.procedure.practice")), copy("soon.practice"));

  // 我在这里怎么错、关联题目、我的证据
  await pressFor(button(copy("mistakes.compare"), true), copy("soon.compare"));
  await pressFor(button(copy("mistakes.make_card"), true), copy("soon.make_card"));
  await pressFor(button(copy("questions.add"), true), copy("soon.add_question"));
  await pressFor(button(copy("questions.practice"), true), copy("soon.practice"));
  await pressFor(button(named("evidence.all")), copy("soon.evidence_all"));

  // 在哪里学、知识关系、卡片与笔记
  await expect(main.getByRole("link", { name: reader.title })).toHaveAttribute("href", `/reader/${reader.id}`);
  await pressFor(button(copy("relations.adopt"), true), copy("soon.adopt"));
  await expect(main.getByRole("link", { name: copy("cards.review") })).toHaveAttribute("href", "/review");
  await expect(main.getByRole("link", { name: copy("cards.open_notes") })).toHaveAttribute("href", "/notes");
  await pressFor(button(copy("cards.add_card"), true), copy("soon.add_card"));
  await pressFor(button(copy("cards.add_note"), true), copy("soon.add_note"));

  // 点前置知识点：打开那个知识点的主页（路由表里的 /kp/<知识点 ID>）
  const prerequisite = KJ.extra.relations?.find((group) => group.type === "prerequisite")?.items.find((item) => item.point_id !== undefined);
  if (prerequisite?.point_id === undefined) throw new Error("示范知识点没有可点的前置知识点");
  const link = main.getByRole("link", { name: copy("relations.item", { type: copy("relations.type.prerequisite"), name: prerequisite.name }) });
  await expect(link).toHaveAttribute("href", `/kp/${prerequisite.point_id}`);
  await link.press("Enter");
  await expect(title(page, prerequisite.name)).toBeVisible();
  expectNoProblems(watch, "normal");
});
