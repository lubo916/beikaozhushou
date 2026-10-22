// U13：全部视图、七态、三档宽度、四考试和 P0 操作。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";
type Json = Record<string, unknown>;
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S13.json");
function copy(path: string): string {
  let value: unknown = COPY;
  for (const key of path.split(".")) value = typeof value === "object" && value !== null ? (value as Json)[key] : undefined;
  if (typeof value !== "string") throw new Error(`S13 文案缺少 ${path}`);
  return value;
}
interface Segment {
  readonly id: string;
  readonly point_name: string;
  readonly transcript_before: string;
  readonly transcript: string;
  readonly transcript_after: string;
}
interface Fixture {
  readonly exam_title: string;
  readonly courses: readonly { readonly title: string; readonly current_segment_id: string; readonly segments: readonly Segment[] }[];
  readonly external_courses: readonly { readonly url: string }[];
}
const KJ = readJson("fixtures/pages/S13/junior-accounting.json") as Fixture;
const EXAMS = (readJson("fixtures/exams/index.json") as { readonly exams: readonly { readonly key: string; readonly exam_id: string }[] })
  .exams;
const entry = pageById("S13");
for (const width of [375, 834, 1280]) {
  for (const view of entry.views) {
    test(`S13 ${view.key}：${width} 宽能打开且正文不溢出`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const watch = await watchPage(page);
      await watch.open(urlOf(entry, { view: view.key }));
      await expectOpened(page, entry, view);
      await expectLoaded(page, entry);
      const body = page.locator("main#main");
      await expect(body.getByRole("heading", { level: 1, name: copy("title"), exact: true })).toBeVisible();
      await expect(body.getByRole("tab", { name: copy(`tabs.${view.key}`), exact: true })).toHaveAttribute("aria-selected", "true");
      expect(await body.evaluate((element) => element.scrollWidth - element.clientWidth), "正文区不应横向溢出").toBeLessThanOrEqual(1);
      expectNoProblems(watch, "normal");
      await page.screenshot({ path: testInfo.outputPath("classroom.png"), fullPage: true });
    });
  }
}
test("S13 七态，空态保留页头，数据不足只限制音频", async ({ page }) => {
  test.setTimeout(90_000);
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state, view: state === "insufficient_data" ? "audio" : "video" }));
    await expectState(page, entry, state);
    expectNoProblems(watch, state);
    if (state === "empty") {
      await expect(page.locator("main#main").getByRole("heading", { level: 1, name: copy("title"), exact: true })).toBeVisible();
      await expect(page.locator("main#main").getByRole("link", { name: copy("state.empty.action"), exact: true })).toHaveAttribute(
        "href",
        "/materials",
      );
    }
    if (state === "insufficient_data") await expect(page.getByRole("tab", { name: copy("tabs.video"), exact: true })).toBeVisible();
  }
});
test("S13 四个演示考试使用各自课堂假数据", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    const fixture = readJson(`fixtures/pages/S13/${exam.exam_id}.json`) as Fixture;
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectLoaded(page, entry);
    await expect(page.locator("main#main")).toContainText(fixture.exam_title);
    const course = fixture.courses[0];
    if (course === undefined) throw new Error("缺少示例课程");
    await expect(page.locator("main#main")).toContainText(course.title);
    expectNoProblems(watch, "normal", `${exam.key}：`);
  }
});
test("S13 主要操作：来源、播放、上下文提问、打点草稿及检测入口", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const body = page.locator("main#main");
  const source = body.getByLabel(copy("player.source"), { exact: true });
  for (const index of [1, 2, 0]) await source.selectOption({ index });
  await body.getByRole("button", { name: copy("player.play"), exact: true }).press("Enter");
  await expect(body.getByRole("button", { name: copy("player.pause"), exact: true })).toBeVisible();
  await body.getByRole("button", { name: copy("actions.ask"), exact: true }).press("Enter");
  const ask = page.getByRole("dialog");
  await expect(ask).toBeVisible();
  const course = KJ.courses[0];
  const segment = course?.segments.find((item) => item.id === course.current_segment_id);
  if (segment === undefined) throw new Error("缺少当前讲解片段");
  for (const transcript of [segment.transcript_before, segment.transcript, segment.transcript_after])
    await expect(ask).toContainText(transcript);
  await ask.locator("textarea").fill("这里的适用条件是什么？");
  await ask.getByRole("button", { name: copy("ask.send"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("ask.soon") })).toBeVisible();
  if (await ask.isVisible()) await page.keyboard.press("Escape");
  await body.getByRole("button", { name: copy("actions.note"), exact: true }).press("Enter");
  const note = page.getByRole("dialog");
  await note.getByLabel(copy("note.label"), { exact: true }).fill("先判断适用条件");
  await note.getByRole("button", { name: copy("note.save"), exact: true }).press("Enter");
  await expect(body).toContainText("先判断适用条件");
  // P0 双向定位：先从知识点时间轴切到首段，再点笔记的时间戳回到记笔记的片段。
  const firstSegment = course?.segments[0];
  if (firstSegment === undefined) throw new Error("缺少时间轴首段");
  const player = body.getByRole("region", { name: copy("player.title"), exact: true });
  await body
    .locator(`div[aria-label="${copy("player.timeline")}"]`)
    .getByRole("button")
    .first()
    .press("Enter");
  await expect(player.getByRole("heading", { name: firstSegment.point_name, exact: true })).toBeVisible();
  await body.locator("article").filter({ hasText: "先判断适用条件" }).getByRole("button").press("Enter");
  await expect(player.getByRole("heading", { name: segment.point_name, exact: true })).toBeVisible();
  await expect(body.getByRole("link", { name: copy("check.start"), exact: true })).toHaveAttribute("href", "/quiz/demo");
  await body.getByRole("button", { name: copy("player.calibrate"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("player.calibrateSoon") })).toBeVisible();
  await body.getByRole("tab", { name: copy("tabs.audio"), exact: true }).press("Enter");
  const audioPlay = body.getByRole("button", {
    name: copy("audio.play_segment").replace("{{name}}", firstSegment.point_name),
    exact: true,
  });
  await audioPlay.press("Enter");
  await expect(audioPlay).toHaveAttribute("aria-pressed", "true");
  await expect(body.getByRole("link", { name: copy("audio.check"), exact: true })).toHaveAttribute("href", "/quiz/demo");
  await body.getByRole("tab", { name: copy("tabs.ext"), exact: true }).press("Enter");
  const external = KJ.external_courses[0];
  if (external === undefined) throw new Error("缺少外部课程");
  await expect(body.getByRole("link", { name: copy("external.open"), exact: true }).first()).toHaveAttribute("href", external.url);
  await body.getByRole("button", { name: copy("external.record"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("external.soon") })).toBeVisible();
  expectNoProblems(watch, "normal");
});
