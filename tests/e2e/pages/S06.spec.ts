// S06 今日的冒烟测试（照 S10 样板页写；U06a 上半：英雄区、三段清单与任务条；U06b 下半：三个数、计划调整、提议、节点提醒与各视图的专属部件）。
// 覆盖：三档宽度（桌面左右两栏、右栏是三个数与计划调整；平板单栏、三个数整张排在清单下面；手机单栏、英雄区下面置顶一行待确认的调整、
// 三个数折叠成一行摘要；英雄区在清单上面，正文不横向溢出，桌面首屏能看到第一项任务）；六个视图都能用 ?view= 打开、各有专属部件；
// 七态用 ?state= 强制显示、文案按 bk spec；四个演示考试都能打开；主要按钮都能点——跳到路由表里的页面，或提示“即将上线”。
// 按钮用键盘触发（locator.press），不受右下角“问导师”浮标遮挡；文案与演示数据从仓库文件读，不在测试里抄一份。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator } from "@playwright/test";
import { pathTo as learnerPath } from "../../../apps/learner/src/routes.ts";
import { VOCAB } from "../../../packages/shared/src/vocab/index.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

interface IndexJson {
  readonly exams: readonly { readonly key: string; readonly exam_id: string }[];
}

interface PageJson {
  readonly tasks: readonly { readonly id: string; readonly polished?: string }[];
}

const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S06.json");
/** 公共组件的文案（撤销、确认、不改这些按钮名）。 */
const UI = readJson("packages/ui/src/copy.zh-CN.json") as { readonly action: Readonly<Record<string, string>> };
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

/** 本页文案：按“a.b.c”取一条原文。 */
function raw(path: string): string {
  let node: unknown = COPY;
  for (const key of path.split(".")) node = typeof node === "object" && node !== null ? (node as Record<string, unknown>)[key] : undefined;
  if (typeof node !== "string") throw new Error(`S06.json 里没有文案 ${path}`);
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

/** 带任意占位符的整句（占位符处匹配任意文字，如“{{n}} 条调整待你确认：{{title}}”）。 */
function pattern(path: string): RegExp {
  const escaped = raw(path).replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  return new RegExp(escaped.replace(PLACEHOLDER, ".+"));
}

/** 句子开头到第一个占位符为止（用来认出带数字的句子）。 */
const lead = (path: string): string => raw(path).split("{{")[0] ?? "";

const entry = pageById("S06");
const EXAMS = (readJson("fixtures/exams/index.json") as IndexJson).exams;
const KJ = readJson("fixtures/pages/S06/junior-accounting.json") as PageJson;
const POLISHED = KJ.tasks.find((task) => task.polished !== undefined)?.polished ?? "";

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.first().boundingBox();
  if (box === null) throw new Error("元素没有显示出来，量不到位置");
  return box;
}

const WIDTHS = [
  { width: 375, height: 812, split: false, phone: true },
  { width: 834, height: 900, split: false, phone: false },
  { width: 1280, height: 900, split: true, phone: false },
] as const;

for (const size of WIDTHS) {
  const layout = size.split ? "左右两栏，右栏是三个数与计划调整" : size.phone ? "单栏，三个数折叠成一行" : "单栏，三个数排在清单下面";
  test(`S06 ${size.width} 宽：${layout}，英雄区在清单上面，正文不横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry));
    await expectOpened(page, entry, entry.views[0]);
    await expectLoaded(page, entry);
    const body = page.locator("main#main");
    const hero = await boxOf(body.getByRole("region", { name: copy("hero.label") }));
    const list = await boxOf(body.locator(".ui-taskgroup"));
    expect(list.y, "清单应在英雄区下面").toBeGreaterThanOrEqual(hero.y + hero.height - 1);
    const cols = await boxOf(body.locator(".ui-cols"));
    const main = await boxOf(body.locator(".ui-cols__main"));
    if (size.split) {
      expect(main.width, "桌面主栏不占满，右边留给右栏").toBeLessThan(cols.width - 1);
      const first = await boxOf(body.locator(".ui-task"));
      expect(first.y, "第一项任务要在首屏出现").toBeLessThan(size.height);
    } else {
      expect(main.width, "窄屏单栏：主栏占满").toBeGreaterThanOrEqual(cols.width - 1);
    }
    // 右栏（bk spec 布局）：桌面在右边；平板在清单下面整张显示；手机英雄区下面置顶一行待确认的调整，三个数折叠成一行摘要
    const card = body.getByRole("region", { name: copy("metrics.title"), exact: true });
    const summary = body.getByRole("region", { name: copy("metrics.summary_label"), exact: true });
    const pin = body.getByRole("button", { name: pattern("plan_adjust.pin") });
    const adjust = await boxOf(body.getByRole("region", { name: copy("plan_adjust.title"), exact: true }));
    if (size.phone) {
      await expect(card, "手机不显示整张的三个数").toBeHidden();
      const row = await boxOf(summary);
      const top = await boxOf(pin);
      expect(top.y, "置顶的一行在英雄区下面").toBeGreaterThanOrEqual(hero.y + hero.height - 1);
      expect(list.y, "清单在置顶的一行下面").toBeGreaterThanOrEqual(top.y + top.height - 1);
      expect(row.y, "三个数摘要在清单下面").toBeGreaterThan(list.y);
      expect(adjust.y, "计划调整在三个数摘要下面").toBeGreaterThanOrEqual(row.y + row.height - 1);
    } else {
      await expect(summary, "平板与桌面不显示一行摘要").toBeHidden();
      await expect(pin, "平板与桌面没有置顶的那一行").toBeHidden();
      const numbers = await boxOf(card);
      if (size.split) expect(numbers.x, "三个数在右栏").toBeGreaterThanOrEqual(main.x + main.width - 1);
      else expect(numbers.y, "平板：三个数在清单下面").toBeGreaterThan(list.y);
      expect(adjust.y, "计划调整在三个数下面").toBeGreaterThanOrEqual(numbers.y + numbers.height - 1);
    }
    const overflow = await body.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow, "正文区不应横向溢出").toBeLessThanOrEqual(1);
    expectNoProblems(watch, "normal");
  });
}

test("S06 六个视图都能用 ?view= 打开，各有各的样子", async ({ page }) => {
  expect(entry.views.map((view) => view.key)).toEqual(["normal", "first", "done", "off", "back", "noai"]);
  const watch = await watchPage(page);
  const body = page.locator("main#main");
  for (const view of entry.views) {
    await watch.open(urlOf(entry, { view: view.key }));
    await expectOpened(page, entry, view);
    await expectLoaded(page, entry);
    if (view.key === "normal") await expect(body, "正常视图：润色过的理由").toContainText(POLISHED);
    if (view.key === "first") await expect(body).toContainText(lead("hero.line.first"));
    if (view.key === "done") await expect(body.getByRole("button", { name: copy("hero.tomorrow"), exact: true })).toBeVisible();
    if (view.key === "off") await expect(body).toContainText(copy("list.off_meta"));
    if (view.key === "back") await expect(body).toContainText(copy("list.back_title"));
    if (view.key === "noai") {
      await expect(body, "导师不可用：理由用模板句").toContainText(copy("reason.not_learned"));
      await expect(body).not.toContainText(POLISHED);
      await expect(body.getByRole("status").filter({ hasText: copy("noai.title") }), "最上面说明导师暂时不可用").toBeVisible();
    }
    // 下半：三个数各视图常驻；首次进入是上手清单、还没有计划调整；中断回归在启动任务下面给重组提议
    await expect(body.getByRole("region", { name: copy("metrics.title"), exact: true }), `视图 ${view.key}：三个数`).toBeVisible();
    const adjust = body.getByRole("region", { name: copy("plan_adjust.title"), exact: true });
    if (view.key === "first") {
      await expect(body.getByRole("group", { name: copy("onboarding.label") }), "首次进入：上手清单").toBeVisible();
      await expect(adjust, "首次进入还没有计划调整").toHaveCount(0);
    } else {
      await expect(adjust, `视图 ${view.key}：计划调整`).toBeVisible();
    }
    if (view.key === "back") {
      const restart = body.locator(".ui-proposal").filter({ hasText: lead("proposal.kind.reconnect_reorganize") });
      await expect(restart, "中断回归：重组提议").toBeVisible();
      await expect(restart.getByRole("button", { name: UI.action["confirm"] ?? "", exact: true })).toBeVisible();
    }
    expectNoProblems(watch, "normal", `视图 ${view.key}：`);
  }
});

test("S06 七态都能用 ?state= 强制显示，文案按 bk spec", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    expectNoProblems(watch, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    const list = page.locator("main#main .ui-taskgroup").first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.title"));
      await expect(shown).toContainText(copy("state.empty.body"));
      await expect(shown.getByRole("link", { name: copy("state.empty.action") })).toHaveAttribute("href", "/start-report");
    }
    if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
    if (state === "restricted") {
      await expect(shown).toContainText(copy("state.restricted.body"));
      await expect(list, "受限只暂停高成本 AI，清单照常").toBeVisible();
    }
    if (state === "insufficient_data") {
      await expect(shown).toContainText(copy("state.insufficient_data.body"));
      await expect(list, "数据不足时清单照常").toBeVisible();
      const numbers = page.locator("main#main").getByRole("region", { name: copy("metrics.title"), exact: true });
      await expect(numbers, "数据不足：预测与健康度不下结论，只给原始计数").toContainText(copy("metrics.insufficient"));
      await expect(numbers).toContainText(lead("metrics.forecast.shortfall"));
    }
  }
});

test("S06 四个演示考试切过去，三段清单都能打开", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectLoaded(page, entry);
    await expect(page.locator("main#main .ui-taskgroup"), `${exam.key} 的三段清单`).toHaveCount(3);
    expectNoProblems(watch, "normal", `${exam.key}：`);
  }
});

test("S06 主要按钮都能点：跳到路由表里的页面，或提示“即将上线”", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const button = (name: string | RegExp, exact = false): Locator => main.getByRole("button", { name, exact }).first();
  const toastShows = async (text: string): Promise<void> => {
    await expect(page.getByRole("status").filter({ hasText: text }), `点了以后应提示：${text}`).toBeVisible();
  };
  // 英雄区：我只有 N 分钟（短时重组，时长是参数）
  await button(named("hero.short")).press("Enter");
  await toastShows(copy("soon.short"));
  // 今日清单：为什么这样排（说明里能去学习计划）
  await button(copy("list.why"), true).press("Enter");
  const why = page.getByRole("dialog", { name: copy("order.title") });
  await expect(why).toBeVisible();
  await expect(why.getByRole("link", { name: copy("order.plan") })).toHaveAttribute("href", "/plan");
  await why.getByRole("button", { name: copy("order.close"), exact: true }).press("Enter");
  await expect(why).toBeHidden();
  // 换档：精简版
  await button(new RegExp(`^${VOCAB.degrade_tier.lite}`)).press("Enter");
  await toastShows(copy("soon.tier"));
  // 手动勾选或剔除：记为看过
  await button(copy("list.adjust"), true).press("Enter");
  const adjust = page.getByRole("dialog", { name: copy("adjust.title") });
  await expect(adjust).toBeVisible();
  await adjust
    .getByRole("button", { name: copy("adjust.seen"), exact: true })
    .first()
    .press("Enter");
  await toastShows(copy("soon.seen"));
  // 右栏：三个数“详情”去进度与预测；节点提醒的“考试日历”；计划调整的撤销、确认、不改与收件箱的去归档都提示“即将上线”
  await expect(main.getByRole("link", { name: copy("metrics.detail"), exact: true }).first()).toHaveAttribute("href", learnerPath("S24"));
  await expect(main.getByRole("link", { name: copy("milestones.calendar"), exact: true })).toHaveAttribute("href", learnerPath("S25"));
  await button(UI.action["undo"] ?? "", true).press("Enter");
  await toastShows(copy("soon.undo"));
  await button(UI.action["confirm"] ?? "", true).press("Enter");
  await toastShows(copy("soon.confirm"));
  await button(UI.action["decline"] ?? "", true).press("Enter");
  await toastShows(copy("soon.decline"));
  await button(copy("inbox.action"), true).press("Enter");
  await toastShows(copy("soon.inbox"));
  // 任务条的标题直达具体位置；英雄区的“继续”跳到下一项
  await expect(main.locator(".ui-task a").first()).toHaveAttribute("href", /^\/(review|quiz|reader|recite|recap|kp|mistakes)\b/);
  const next = main.getByRole("link", { name: copy("hero.continue", { source: VOCAB.task_source.verify_recheck }), exact: true });
  await expect(next).toHaveAttribute("href", "/quiz/demo");
  await next.press("Enter");
  await expect(page).toHaveURL(/\/quiz\/demo$/);
  expectNoProblems(watch, "normal");
});

test("S06 手机：英雄区下面置顶一行说有几条调整待确认，点了跳到计划调整", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const pin = main.getByRole("button", { name: pattern("plan_adjust.pin") });
  await expect(pin).toContainText(copy("proposal.kind.calibrate"));
  const adjust = main.getByRole("region", { name: copy("plan_adjust.title"), exact: true });
  await expect(adjust, "计划调整在清单下面，一开始不在首屏").not.toBeInViewport();
  await pin.press("Enter");
  await expect(adjust).toBeInViewport();
  await expect(adjust).toBeFocused();
  expectNoProblems(watch, "normal");
});

test("S06 首次进入：上手清单在英雄区里，没做的项直达对应页面，“跳过”提示即将上线", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "first" }));
  await expectLoaded(page, entry);
  const group = page.locator("main#main").getByRole("group", { name: copy("onboarding.label") });
  await expect(group).toContainText(copy("onboarding.title"));
  await expect(group.getByRole("link", { name: copy("onboarding.step.ask_tutor"), exact: true })).toHaveAttribute(
    "href",
    learnerPath("S28"),
  );
  await group.getByRole("button", { name: copy("onboarding.skip"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("soon.onboarding_skip") })).toBeVisible();
  expectNoProblems(watch, "normal");
});

test("S06《数据结构》期末：地图体检不通过，预测锁定并给“去修复”，其余两个数照常", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { exam: "ds" }));
  await expectLoaded(page, entry);
  const numbers = page.locator("main#main").getByRole("region", { name: copy("metrics.title"), exact: true });
  await expect(numbers).toContainText(copy("metrics.forecast.locked"));
  await expect(numbers.getByRole("link", { name: copy("metrics.fix"), exact: true })).toHaveAttribute("href", learnerPath("S09"));
  await expect(numbers).toContainText(copy("metrics.completion.hint"));
  expectNoProblems(watch, "normal", "ds：");
});
