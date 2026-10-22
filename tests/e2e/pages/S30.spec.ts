// S30 简版：三档布局、七态、四考试、内容治理和简版入口冒烟。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import copy from "../../../apps/learner/src/i18n/zh-CN/S30.json" with { type: "json" };
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const entry = pageById("S30");
const exams = JSON.parse(readFileSync(join(ROOT, "fixtures/exams/index.json"), "utf8")) as { exams: { key: string; exam_id: string }[] };
const fixture = (examId: string) =>
  JSON.parse(readFileSync(join(ROOT, `fixtures/pages/S30/${examId}.json`), "utf8")) as { rooms: { name: string }[] };
function firstRoomName(examId: string): string {
  const first = fixture(examId).rooms[0];
  if (first === undefined) throw new Error(`S30 演示考试 ${examId} 没有自习室`);
  return first.name;
}
for (const width of [375, 834, 1280]) {
  test(`S30 ${width} 宽主视图与正文无横向溢出`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry));
    await expectOpened(page, entry, undefined);
    await expectLoaded(page, entry);
    const main = page.locator("main#main");
    await expect(main.getByRole("heading", { name: copy.room.title, exact: true })).toBeVisible();
    await expect(main.getByRole("heading", { name: copy.governance.title, exact: true })).toBeVisible();
    const left = await main.locator(".ui-cols__main").boundingBox();
    const right = await main.locator(".ui-cols__aside").boundingBox();
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    if (left !== null && right !== null) {
      if (width === 1280) expect(right.x).toBeGreaterThanOrEqual(left.x + left.width - 1);
      else expect(right.y).toBeGreaterThanOrEqual(left.y + left.height - 1);
    }
    expect(await main.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expectNoProblems(watch, "normal");
    await page.screenshot({ path: testInfo.outputPath(`S30-${width}.png`), fullPage: true });
  });
}
test("S30 只有主视图，七态按原型显示；未成年人只留自习室和番茄钟", async ({ page }) => {
  expect(entry.views).toEqual([]);
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    if (state === "empty") await expect(shown).toContainText(copy.state.empty.title);
    if (state === "offline") await expect(shown).toContainText(copy.state.offline.body);
    if (state === "restricted") {
      await expect(shown).toContainText(copy.state.restricted.body);
      await expect(page.getByRole("heading", { name: copy.room.title, exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: copy.focus.title, exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: copy.group.title, exact: true })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: copy.governance.title, exact: true })).toHaveCount(0);
    }
    if (state === "insufficient_data") await expect(shown).toContainText(copy.state.insufficient_data.body);
    expectNoProblems(watch, state);
  }
});
test("S30 四考试分别显示对应的自习室", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of exams.exams) {
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectLoaded(page, entry);
    await expect(page.getByRole("heading", { name: firstRoomName(exam.exam_id), exact: true })).toBeVisible();
    expectNoProblems(watch, "normal");
  }
});
test("S30 举报和屏蔽需明确操作，主要入口提示即将上线", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  for (const [button, message] of [
    [copy.room.enter, copy.soon.room],
    [copy.focus.choose, copy.soon.task],
    [copy.focus.start, copy.soon.focus],
    [copy.group.action, copy.soon.group],
  ] as const) {
    await main.getByRole("button", { name: button, exact: true }).first().press("Enter");
    await expect(page.getByRole("status").filter({ hasText: message })).toBeVisible();
  }
  await main.getByRole("button", { name: copy.governance.report, exact: true }).press("Enter");
  const report = page.getByRole("dialog", { name: copy.report.title, exact: true });
  await expect(report).toBeVisible();
  await report.getByRole("radio", { name: copy.report.reasons.anxiety, exact: true }).check();
  await report.getByRole("button", { name: copy.report.submit, exact: true }).press("Enter");
  await expect(report).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: copy.soon.report })).toBeVisible();
  const roomName = firstRoomName("junior-accounting");
  await main.getByRole("button", { name: copy.room.block_room.replace("{{name}}", roomName), exact: true }).press("Enter");
  const block = page.getByRole("alertdialog", { name: copy.block.title, exact: true });
  await expect(block).toBeVisible();
  await block.getByRole("button", { name: copy.block.cancel, exact: true }).press("Enter");
  await expect(block).toBeHidden();
  await main.getByRole("button", { name: copy.room.block_room.replace("{{name}}", roomName), exact: true }).press("Enter");
  await block.getByRole("button", { name: copy.block.submit, exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy.soon.block })).toBeVisible();
  expectNoProblems(watch, "normal");
});
