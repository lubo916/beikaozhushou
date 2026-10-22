// U21 简版：主视图、三档宽度、七态、画像开启及每次单独同意录音留存。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";
import copy from "../../../apps/learner/src/i18n/zh-CN/S21.json" with { type: "json" };

interface ExamIndex {
  readonly exams: readonly { readonly key: string; readonly exam_id: string }[];
}
interface Fixture {
  readonly exam_name: string;
  readonly activation: "automatic" | "manual" | "disabled";
  readonly scenarios: readonly { readonly title: string }[];
  readonly radar: { readonly minimum_samples: number };
}
const entry = pageById("S21");
const EXAMS = (JSON.parse(readFileSync(join(ROOT, "fixtures/exams/index.json"), "utf8")) as ExamIndex).exams;
const fixture = (examId: string): Fixture => JSON.parse(readFileSync(join(ROOT, `fixtures/pages/S21/${examId}.json`), "utf8")) as Fixture;
const WIDTHS = [
  { width: 375, height: 812, split: false },
  { width: 834, height: 900, split: false },
  { width: 1280, height: 900, split: true },
] as const;
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("元素尚未显示，无法检查布局");
  return box;
}

for (const size of WIDTHS) {
  test(`S21 ${size.width} 宽主视图布局正确，正文无横向溢出`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const watch = await watchPage(page);
    await watch.open(`${urlOf(entry)}?view=main`);
    await expectOpened(page, entry, undefined);
    await expectLoaded(page, entry);
    await expect(page.getByTestId("s21-home")).toBeVisible();
    const main = await boxOf(page.locator("main#main .ui-cols__main"));
    const aside = await boxOf(page.locator("main#main .ui-cols__aside"));
    if (size.split) expect(aside.x).toBeGreaterThanOrEqual(main.x + main.width - 1);
    else expect(aside.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
    expect(await page.locator("main#main").evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expectNoProblems(watch, "normal");
    await page.screenshot({ path: testInfo.outputPath("S21.png"), fullPage: true });
  });
}

test("S21 七态按接口结果显示，局部受限和样本不足保留其他内容", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy.state.empty.title);
      await expect(shown).toContainText(copy.state.empty.body);
      await shown.getByRole("button", { name: copy.state.empty.action, exact: true }).press("Enter");
      await expect(page.getByRole("dialog", { name: copy.flow.title })).toBeVisible();
      await page.getByRole("button", { name: copy.flow.cancel, exact: true }).press("Enter");
    }
    if (state === "offline") await expect(shown).toContainText(copy.state.offline.title);
    if (state === "restricted") {
      await expect(shown).toContainText(copy.privacy.restricted_body);
      await expect(page.getByText(copy.assessment.title, { exact: true })).toBeVisible();
    }
    if (state === "insufficient_data") {
      await expect(shown).toContainText(
        copy.radar.insufficient_body.replace("{{minimum}}", String(fixture("junior-accounting").radar.minimum_samples)),
      );
      await expect(page.getByText(copy.assessment.title, { exact: true })).toBeVisible();
    }
    expectNoProblems(watch, state);
  }
});

test("S21 四个演示考试按画像展示场景，未开启的可手动开启并关闭本次训练", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    const data = fixture(exam.exam_id);
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectOpened(page, entry, undefined);
    const main = page.locator("main#main");
    if (data.activation === "disabled") {
      await expect(main.getByText(copy.activation.disabled_title, { exact: true })).toBeVisible();
      await main.getByRole("button", { name: copy.activation.enable, exact: true }).first().press("Enter");
      await expect(page.getByTestId("s21-home")).toBeVisible();
      await expect(main.getByText(data.scenarios[0]?.title ?? "", { exact: true })).toBeVisible();
      await main.getByRole("button", { name: copy.activation.close, exact: true }).press("Enter");
      await expect(main.getByText(copy.activation.disabled_title, { exact: true })).toBeVisible();
    } else {
      await expectLoaded(page, entry);
      await expect(page.getByTestId("s21-home")).toBeVisible();
      await expect(main.getByText(data.activation === "automatic" ? copy.header.auto : copy.header.manual, { exact: true })).toBeVisible();
      await expect(main.getByText(data.scenarios[0]?.title ?? "", { exact: true })).toBeVisible();
    }
    expectNoProblems(watch, "normal", `${exam.key}：`);
  }
});

test("S21 录音默认仅音频不留存，单独同意只用于本次流程，确认仅给预览提示", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  await main.getByRole("button", { name: copy.header.start, exact: true }).press("Enter");
  let dialog = page.getByRole("dialog", { name: copy.flow.title });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: copy.flow.save, exact: true })).not.toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: copy.flow.video, exact: true })).not.toBeChecked();
  await expect(dialog).toContainText(copy.flow.no_save);
  await dialog.getByRole("checkbox", { name: copy.flow.save, exact: true }).check();
  await expect(dialog).toContainText(copy.flow.save_selected);
  await dialog.getByRole("button", { name: copy.flow.cancel, exact: true }).press("Enter");
  await main.getByRole("button", { name: copy.scenes.start }).first().press("Enter");
  dialog = page.getByRole("dialog", { name: copy.flow.title });
  await expect(dialog.getByRole("checkbox", { name: copy.flow.save, exact: true })).not.toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: copy.flow.video, exact: true })).not.toBeChecked();
  await dialog.getByRole("button", { name: copy.flow.confirm, exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy.soon.start })).toBeVisible();
  await expect(dialog).toBeHidden();
  expectNoProblems(watch, "normal");
});

test("S21 视频受限时仍可继续仅音频流程，P1 按钮有明确即将上线提示", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { state: "restricted" }));
  await expectState(page, entry, "restricted");
  await page.getByRole("button", { name: copy.privacy.restricted_action, exact: true }).press("Enter");
  const dialog = page.getByRole("dialog", { name: copy.flow.title });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: copy.flow.video, exact: true })).toBeDisabled();
  await expect(dialog.getByRole("checkbox", { name: copy.flow.save, exact: true })).not.toBeChecked();
  await dialog.getByRole("button", { name: copy.flow.cancel, exact: true }).press("Enter");
  const main = page.locator("main#main");
  for (const [name, message] of [
    [copy.next.proposal, copy.soon.proposal],
    [copy.assessment.retry, copy.soon.retry],
    [copy.assessment.history, copy.soon.history],
    [copy.transcript.play, copy.soon.play],
  ]) {
    if (name === undefined || message === undefined) throw new Error("缺少按钮文案");
    await main.getByRole("button", { name }).first().press("Enter");
    const opened = page.getByRole("dialog", { name: copy.flow.title });
    if (await opened.isVisible()) await opened.getByRole("button", { name: copy.flow.cancel, exact: true }).press("Enter");
    await expect(page.getByRole("status").filter({ hasText: message })).toBeVisible();
  }
  expectNoProblems(watch, "restricted");
});
