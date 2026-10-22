// S18 做题与解析的冒烟测试（U18a，照 S10 样板写）。覆盖：三档宽度的布局与原型一致（桌面题目与右栏两栏，平板与手机单栏、本组进度排在下面，
// 手机上提交条贴在底部），正文不横向溢出；两个视图都能用 ?view= 打开；七态用 ?state= 强制显示、文案按 bk spec；四个演示考试都能打开两个示范题组；
// 主要按钮都能点——作答、选把握度、提交后揭晓并锁定、下一题；生成题揭晓后确认“题目没问题”；还没有后端的按钮提示“即将上线”。
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
interface QuestionJson {
  readonly id: string;
  readonly options?: readonly string[];
}
interface SessionJson {
  readonly title: string;
  readonly items: readonly { readonly question_id: string }[];
}
interface PageJson {
  readonly sessions: { readonly objective: SessionJson; readonly generated: SessionJson };
  readonly questions: readonly QuestionJson[];
}

const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as unknown;
const PAGE_COPY = readJson("apps/learner/src/i18n/zh-CN/S18.json");
const QUIZ_COPY = readJson("packages/ui/src/quiz/copy.zh-CN.json");
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

/** 按“a.b.c”取一条原文。 */
function raw(source: unknown, path: string): string {
  let node: unknown = source;
  for (const key of path.split(".")) node = typeof node === "object" && node !== null ? (node as Record<string, unknown>)[key] : undefined;
  if (typeof node !== "string") throw new Error(`文案里没有 ${path}`);
  return node;
}

/** 本页文案，填好占位符。 */
function copy(path: string, values: Readonly<Record<string, string | number>> = {}): string {
  return raw(PAGE_COPY, path).replace(PLACEHOLDER, (whole: string, name: string) =>
    values[name] === undefined ? whole : String(values[name]),
  );
}

/** 共用作答组件的文案。 */
const quiz = (path: string): string => raw(QUIZ_COPY, path);

const pageOf = (examId: string): PageJson => readJson(`fixtures/pages/S18/${examId}.json`) as PageJson;
const examQuestions = (examId: string): readonly QuestionJson[] =>
  (readJson(`fixtures/exams/${examId}/questions.json`) as { readonly questions: readonly QuestionJson[] }).questions;

/** 示范题组第 index 道题的第一个选项。 */
function firstOption(examId: string, kind: "objective" | "generated", index: number): string {
  const page = pageOf(examId);
  const id = page.sessions[kind].items[index]?.question_id;
  const question = [...page.questions, ...examQuestions(examId)].find((q) => q.id === id);
  const option = question?.options?.[0];
  if (option === undefined) throw new Error(`${examId} ${kind} 第 ${index + 1} 题没有选项`);
  return option;
}

/** 揭晓后选项的名称会带上“你选的”等标记：按开头匹配。 */
const startsWith = (text: string): RegExp => new RegExp(`^${text.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&")}`);

const entry = pageById("S18");
const EXAMS = (readJson("fixtures/exams/index.json") as IndexJson).exams;
const KJ = pageOf("junior-accounting");

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
  test(`S18 ${size.width} 宽：${size.split ? "题目与右栏两栏" : "单栏，本组进度排在下面"}，正文不横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry));
    await expectOpened(page, entry, entry.views[0]);
    await expectLoaded(page, entry);
    await expect(title(page, KJ.sessions.objective.title)).toBeVisible();
    const main = await boxOf(page.locator("main#main .ui-cols__main"));
    const aside = await boxOf(page.locator("main#main .ui-cols__aside"));
    if (size.split) expect(aside.x, "右栏应在题目右边").toBeGreaterThanOrEqual(main.x + main.width - 1);
    else expect(aside.y, "本组进度应排在题目下面").toBeGreaterThanOrEqual(main.y + main.height - 1);
    const overflow = await page.locator("main#main").evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow, "正文区不应横向溢出").toBeLessThanOrEqual(1);
    if (size.width === WIDTHS[0].width) {
      const position = await page
        .locator("main#main .ui-cols__main .sticky")
        .first()
        .evaluate((element) => getComputedStyle(element).position);
      expect(position, "手机上提交条贴在底部（拇指区）").toBe("sticky");
    }
    expectNoProblems(watch, "normal");
  });
}

test("S18 两个视图都能用 ?view= 打开：obj 客观题、gen 生成题（先做后核）", async ({ page }) => {
  expect(entry.views.map((view) => view.key)).toEqual(["obj", "gen"]);
  const watch = await watchPage(page);
  for (const view of entry.views) {
    await watch.open(urlOf(entry, { view: view.key }));
    await expectOpened(page, entry, view);
    await expectLoaded(page, entry);
    const name = view.key === "gen" ? KJ.sessions.generated.title : KJ.sessions.objective.title;
    await expect(title(page, name), `视图 ${view.key} 的示范题组`).toBeVisible();
    expectNoProblems(watch, "normal", `${view.key}：`);
  }
});

test("S18 七态都能用 ?state= 强制显示，文案按 bk spec", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    expectNoProblems(watch, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.title"));
      await expect(shown).toContainText(copy("state.empty.body"));
      await expect(title(page, KJ.sessions.objective.title), "空态时页头照常").toBeVisible();
      await shown.getByRole("button", { name: copy("state.empty.action"), exact: true }).press("Enter");
      await expect(page.locator("main#main")).toContainText(copy("summary.next_title"));
    }
    if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
    if (state === "restricted") {
      await expect(shown).toContainText(copy("state.restricted.title"));
      await expect(title(page, KJ.sessions.objective.title), "受限只落在题目卡里，其余照常").toBeVisible();
    }
    if (state === "insufficient_data") await expect(shown).toContainText(copy("state.insufficient.body"));
  }
});

test("S18 四个演示考试切过去，两个示范题组都能打开", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    const sessions = pageOf(exam.exam_id).sessions;
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectLoaded(page, entry);
    await expect(title(page, sessions.objective.title), `${exam.key} 的示范题组`).toBeVisible();
    await watch.open(urlOf(entry, { exam: exam.key, view: "gen" }));
    await expectLoaded(page, entry);
    await expect(title(page, sessions.generated.title), `${exam.key} 的导师出题`).toBeVisible();
    expectNoProblems(watch, "normal", `${exam.key}：`);
  }
});

test("S18 主要按钮都能点：作答、选把握度、提交后揭晓并锁定、下一题；还没有后端的按钮提示“即将上线”", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const pressFor = async (target: Locator, toast: string): Promise<void> => {
    await target.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: toast }), `点了以后应提示：${toast}`).toBeVisible();
  };
  await pressFor(page.locator("header").getByRole("button", { name: copy("bar.report"), exact: true }), copy("soon.report"));
  const option = firstOption("junior-accounting", "objective", 3);
  const submit = main.getByRole("button", { name: quiz("submit.action"), exact: true });
  await expect(submit).toBeDisabled();
  await main.getByRole("radio", { name: option, exact: true }).press("Space");
  await expect(main).toContainText(quiz("submit.blocker.confidence"));
  await main.getByRole("radio", { name: new RegExp(quiz("confidence.hint.sure")) }).press("Space");
  await expect(submit).toBeEnabled();
  await submit.press("Enter");
  await expect(main.getByRole("heading", { name: copy("reveal.title"), exact: true })).toBeVisible();
  await expect(main).toContainText(quiz("submit.locked"));
  await expect(main.getByRole("radio", { name: startsWith(option) })).toBeDisabled();
  await pressFor(main.getByRole("button", { name: copy("reveal.explain"), exact: true }), copy("soon.explain"));
  await pressFor(main.getByRole("button", { name: copy("reveal.steps"), exact: true }), copy("soon.steps"));
  await main.getByRole("button", { name: copy("question.next"), exact: true }).press("Enter");
  await expect(main.getByRole("heading", { name: copy("reveal.title"), exact: true })).toHaveCount(0);
  expectNoProblems(watch, "normal");
});

test("S18 生成题：先盲答，揭晓后确认“题目没问题”才计证据", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "gen" }));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  await expect(main).toContainText(copy("question.pending_check"));
  await main.getByRole("radio", { name: firstOption("junior-accounting", "generated", 2), exact: true }).press("Space");
  await main.getByRole("radio", { name: new RegExp(quiz("confidence.hint.sure")) }).press("Space");
  await main.getByRole("button", { name: quiz("submit.action"), exact: true }).press("Enter");
  await expect(main).toContainText(copy("reveal.check_title"));
  await main.getByRole("button", { name: copy("reveal.check_ok"), exact: true }).press("Enter");
  await expect(main).toContainText(copy("reveal.check_done_ok"));
  expectNoProblems(watch, "normal");
});
