// S18 做题与解析的冒烟测试（U18a，照 S10 样板写）。覆盖：三档宽度的布局与原型一致（桌面题目与右栏两栏，平板与手机单栏、本组进度排在下面，
// 手机上提交条贴在底部），正文不横向溢出；两个视图都能用 ?view= 打开；七态用 ?state= 强制显示、文案按 bk spec；四个演示考试都能打开两个示范题组；
// 主要按钮都能点——作答、选把握度、提交后揭晓并锁定、下一题；生成题揭晓后确认“题目没问题”；还没有后端的按钮提示“即将上线”。
// U18b 下半：分步看、讲解与追问（面板带上作答，回复标 AI 生成）、提示阶梯、错因确认（无默认、导师建议、可改选）、引导我想、导师不可用。
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
  readonly hints?: readonly string[];
}
interface SessionJson {
  readonly title: string;
  readonly items: readonly { readonly question_id: string }[];
}
interface PageJson {
  readonly sessions: { readonly objective: SessionJson; readonly generated: SessionJson };
  readonly questions: readonly QuestionJson[];
  readonly solution_layers: Readonly<Record<string, { readonly steps: readonly string[]; readonly wrong_step?: number }>>;
  readonly tutor: { readonly guided_open: string };
}

const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as unknown;
const PAGE_COPY = readJson("apps/learner/src/i18n/zh-CN/S18.json");
const QUIZ_COPY = readJson("packages/ui/src/quiz/copy.zh-CN.json");
const UI_COPY = readJson("packages/ui/src/copy.zh-CN.json");
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

/** 示范题组第 index 道题。 */
function questionAt(examId: string, kind: "objective" | "generated", index: number): QuestionJson {
  const page = pageOf(examId);
  const id = page.sessions[kind].items[index]?.question_id;
  const question = [...page.questions, ...examQuestions(examId)].find((q) => q.id === id);
  if (question === undefined) throw new Error(`${examId} ${kind} 没有第 ${index + 1} 题`);
  return question;
}

/** 示范题组第 index 道题的第 n 个选项（默认第一个）。 */
function firstOption(examId: string, kind: "objective" | "generated", index: number, n = 0): string {
  const option = questionAt(examId, kind, index).options?.[n];
  if (option === undefined) throw new Error(`${examId} ${kind} 第 ${index + 1} 题没有选项`);
  return option;
}

const escapeRe = (text: string): string => text.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
/** 揭晓后选项的名称会带上“你选的”等标记：按开头匹配。 */
const startsWith = (text: string): RegExp => new RegExp(`^${escapeRe(text)}`);
/** 带占位符的文案：占位符处任意文字都算。 */
const pattern = (path: string): RegExp =>
  new RegExp(
    raw(PAGE_COPY, path)
      .split(/\{\{\s*\w+\s*\}\}/)
      .map(escapeRe)
      .join(".+"),
  );

const entry = pageById("S18");
const EXAMS = (readJson("fixtures/exams/index.json") as IndexJson).exams;
const KJ = pageOf("junior-accounting");

function title(page: Page, name: string): Locator {
  return page.getByRole("heading", { level: 1, name, exact: true });
}

/** 同一次布局读取里测两栏，避免分别 await 时页面重排导致使用两个时刻的位置。 */
async function questionLayout(page: Page) {
  return page.locator("main#main").evaluate((element) => {
    const main = element.querySelector(".ui-cols__main");
    const aside = element.querySelector(".ui-cols__aside");
    if (main === null || aside === null) throw new Error("题目或本组进度没有显示出来，量不到位置");
    const box = (node: Element) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      if (width <= 0 || height <= 0 || getComputedStyle(node).visibility === "hidden") throw new Error("元素没有显示出来，量不到位置");
      return { x, y, width, height };
    };
    return { main: box(main), aside: box(aside) };
  });
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
    const { main, aside } = await questionLayout(page);
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

// 每个状态、考试各有自己的默认测试预算；保留原断言，避免多个独立场景累计耗尽同一条测试的时间。
for (const state of ABNORMAL_STATES) {
  test(`S18 七态 ${state} 能用 ?state= 强制显示，文案按 bk spec`, async ({ page }) => {
    const watch = await watchPage(page);
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
  });
}

for (const exam of EXAMS) {
  test(`S18 演示考试 ${exam.key} 的两个示范题组都能打开`, async ({ page }) => {
    const watch = await watchPage(page);
    const sessions = pageOf(exam.exam_id).sessions;
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectLoaded(page, entry);
    await expect(title(page, sessions.objective.title), `${exam.key} 的示范题组`).toBeVisible();
    await watch.open(urlOf(entry, { exam: exam.key, view: "gen" }));
    await expectLoaded(page, entry);
    await expect(title(page, sessions.generated.title), `${exam.key} 的导师出题`).toBeVisible();
    expectNoProblems(watch, "normal", `${exam.key}：`);
  });
}

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
  // U18b：分步看、讲解与追问已接上（原先提示“即将上线”）；变式巩固这一轮仍提示即将上线（U18b-Q4＝A）
  const steps = KJ.solution_layers[questionAt("junior-accounting", "objective", 3).id]?.steps ?? [];
  await main.getByRole("button", { name: copy("reveal.steps"), exact: true }).press("Enter");
  await expect(main).toContainText(copy("reveal.step_item", { n: 1, text: steps[0] ?? "" }));
  await pressFor(main.getByRole("button", { name: copy("reveal.variants"), exact: true }), copy("soon.variants"));
  await main.getByRole("button", { name: copy("reveal.explain"), exact: true }).press("Enter");
  const panel = page.getByRole("dialog", { name: copy("explain.title") });
  await expect(panel).toContainText(copy("explain.carried_title"));
  await expect(panel.locator(".ui-ai").first(), "导师的回复带 AI 生成标识").toBeVisible();
  await panel.getByRole("button", { name: raw(UI_COPY, "action.close"), exact: true }).press("Enter");
  await expect(panel).toBeHidden();
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

test("S18 提示阶梯：提交前一级一级给提示，用过的都留着并说明最高记弱证据；测评态不给提示", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const hints = questionAt("junior-accounting", "objective", 3).hints ?? [];
  expect(hints.length, "示范题至少有两级提示").toBeGreaterThan(1);
  for (const [index, text] of hints.entries()) {
    await main.getByRole("button", { name: copy("question.hint", { n: index + 1, total: hints.length }), exact: true }).press("Enter");
    await expect(main).toContainText(copy("question.hint_item", { n: index + 1, text }));
  }
  await expect(main).toContainText(copy("question.hint_note"));
  await expect(main.getByRole("button", { name: copy("question.hint_done"), exact: true })).toBeDisabled();
  expectNoProblems(watch, "normal");
  await watch.open(urlOf(entry, { state: "restricted" }));
  await expect(main).toContainText(copy("state.restricted.title"));
  await expect(main.getByRole("button", { name: copy("question.hint", { n: 1, total: hints.length }), exact: true })).toHaveCount(0);
  expectNoProblems(watch, "restricted");
});

test("S18 答错后：先讲你选的为什么错；错因七类无默认、标出导师建议，选了就记下、可以改选；引导我想指出第几步", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const question = questionAt("junior-accounting", "objective", 3);
  const wrong = firstOption("junior-accounting", "objective", 3, 1);
  await main.getByRole("radio", { name: wrong, exact: true }).press("Space");
  await main.getByRole("radio", { name: new RegExp(quiz("confidence.hint.sure")) }).press("Space");
  await main.getByRole("button", { name: quiz("submit.action"), exact: true }).press("Enter");
  await expect(main.getByRole("heading", { name: copy("reveal.mine_title_one", { text: wrong }), exact: true })).toBeVisible();
  const causes = main.getByRole("group", { name: copy("reveal.cause_title"), exact: true });
  const chips = causes.locator("[aria-pressed]");
  await expect(chips, "错因七类").toHaveCount(7);
  await expect(causes.locator("[aria-pressed=true]"), "错因无默认").toHaveCount(0);
  await expect(main).toContainText(pattern("reveal.cause_suggest"));
  await chips.nth(0).press("Enter");
  await expect(chips.nth(0)).toHaveAttribute("aria-pressed", "true");
  await expect(main).toContainText(pattern("reveal.cause_saved"));
  await chips.nth(1).press("Enter");
  await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(chips.nth(0)).toHaveAttribute("aria-pressed", "false");
  await main.getByRole("button", { name: copy("reveal.guided"), exact: true }).press("Enter");
  const panel = page.getByRole("dialog", { name: copy("explain.guided_title") });
  await expect(panel).toContainText(KJ.tutor.guided_open);
  await panel.getByRole("textbox", { name: copy("explain.input_guided") }).fill(wrong);
  await panel.getByRole("button", { name: copy("explain.send"), exact: true }).press("Enter");
  await expect(panel).toContainText(copy("explain.wrong_step", { n: KJ.solution_layers[question.id]?.wrong_step ?? 1 }));
  await panel.getByRole("button", { name: raw(UI_COPY, "action.close"), exact: true }).press("Enter");
  await expect(panel).toBeHidden();
  expectNoProblems(watch, "normal");
});

test("S18 导师不可用（演示考试 ds）：讲解面板说明先暂停，解析照常，不报错", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { exam: "ds" }));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  await main.getByRole("radio", { name: firstOption("ds-final-custom", "objective", 1), exact: true }).press("Space");
  await main.getByRole("radio", { name: new RegExp(quiz("confidence.hint.sure")) }).press("Space");
  await main.getByRole("button", { name: quiz("submit.action"), exact: true }).press("Enter");
  await expect(main.getByRole("heading", { name: copy("reveal.conclusion"), exact: true })).toBeVisible();
  await main.getByRole("button", { name: copy("reveal.explain"), exact: true }).press("Enter");
  const panel = page.getByRole("dialog", { name: copy("explain.title") });
  await expect(panel).toContainText(copy("explain.unavailable_title"));
  await expect(panel.locator(".ui-ai"), "导师不可用时没有 AI 回复").toHaveCount(0);
  expectNoProblems(watch, "normal");
});
