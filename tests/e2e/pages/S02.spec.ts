// S02 备考目标：首次与管理视图、三档布局、七态、四个演示考试，以及主要交互。
// 文案取本页 i18n；路由取路由表，避免测试维护第二份页面文案。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { pathTo } from "../../../apps/learner/src/routes.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const COPY: unknown = JSON.parse(readFileSync(join(ROOT, "apps/learner/src/i18n/zh-CN/S02.json"), "utf8"));
const EXAMS = JSON.parse(readFileSync(join(ROOT, "fixtures/exams/index.json"), "utf8")) as {
  readonly default_key: string;
  readonly exams: readonly { readonly key: string; readonly exam_id: string }[];
};
const defaultExam = EXAMS.exams.find((exam) => exam.key === EXAMS.default_key);
if (defaultExam === undefined) throw new Error("演示考试缺少默认考试");
const DEFAULT_FIXTURE = JSON.parse(readFileSync(join(ROOT, `fixtures/pages/S02/${defaultExam.exam_id}.json`), "utf8")) as {
  readonly guest_limit: number;
};
const entry = pageById("S02");
const main = (page: Page) => page.locator("main#main");

function copy(path: string, values: Readonly<Record<string, string | number>> = {}): string {
  let value: unknown = COPY;
  for (const key of path.split("."))
    value = typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  if (typeof value !== "string") throw new Error(`S02.json 缺少文案 ${path}`);
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole: string, key: string) => (values[key] === undefined ? whole : String(values[key])));
}

const WIDTHS = [
  { width: 375, height: 812 },
  { width: 834, height: 900 },
  { width: 1280, height: 900 },
] as const;

for (const size of WIDTHS) {
  for (const view of entry.views) {
    test(`S02 ${view.key}：${size.width} 宽可打开，正文不横向溢出`, async ({ page }, testInfo) => {
      await page.setViewportSize(size);
      const watch = await watchPage(page);
      await watch.open(urlOf(entry, { view: view.key }));
      await expectOpened(page, entry, view);
      await expectLoaded(page, entry);
      if (view.key === "first") await expect(main(page).getByRole("tab", { name: copy("tabs.official"), exact: true })).toBeVisible();
      else await expect(main(page).getByRole("heading", { name: copy("manage.title"), exact: true })).toBeVisible();
      const overflow = await main(page).evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(overflow, "正文区应适应当前宽度").toBeLessThanOrEqual(1);
      expectNoProblems(watch, "normal");
      await page.screenshot({ path: testInfo.outputPath(`S02-${view.key}-${size.width}.png`), fullPage: true });
      if (view.key === "first" && size.width === 375) {
        await main(page)
          .getByRole("button", { name: copy("catalog.choose"), exact: true })
          .first()
          .press("Enter");
        const dialog = page.getByRole("dialog", { name: copy("profile.title"), exact: true });
        await expect(dialog).toBeVisible();
        const panel = await dialog.boundingBox();
        if (panel === null) throw new Error("手机确认画像面板没有显示，无法核对底部布局");
        expect(panel.width, "手机面板不应超出视口宽度").toBeLessThanOrEqual(size.width);
        expect(Math.abs(panel.y + panel.height - size.height), "手机确认画像应贴住视口底部").toBeLessThanOrEqual(1);
        await page.screenshot({ path: testInfo.outputPath("S02-profile-375.png") });
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        expectNoProblems(watch, "normal");
      }
    });
  }
}

test("S02 七态可强制显示，空态、受限与数据不足都有下一步", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state, view: "manage" }));
    await expectState(page, entry, state);
    const shown = main(page).locator(`.ui-state--${state}`).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.title"));
      await expect(shown).toContainText(copy("state.empty.body"));
      await shown.getByRole("button", { name: copy("state.empty.action"), exact: true }).press("Enter");
      await expect(main(page).getByRole("tab", { name: copy("tabs.official"), exact: true })).toBeVisible();
    }
    if (state === "offline") {
      await expect(shown).toContainText(copy("state.offline.body"));
      await expect(main(page).getByRole("heading", { name: copy("title"), exact: true })).toBeVisible();
    }
    if (state === "restricted") {
      await expect(shown).toContainText(copy("state.restricted.body", { limit: DEFAULT_FIXTURE.guest_limit }));
      await expect(shown.getByRole("link", { name: copy("state.restricted.action"), exact: true })).toHaveAttribute("href", pathTo("S31"));
    }
    if (state === "insufficient_data") {
      await expect(shown).toContainText(copy("state.insufficient_data.body"));
      await shown.getByRole("button", { name: copy("state.insufficient_data.action"), exact: true }).press("Enter");
      await expect(main(page).getByRole("tab", { name: copy("tabs.custom"), exact: true })).toHaveAttribute("aria-selected", "true");
      await main(page)
        .getByRole("button", { name: copy("custom.manual"), exact: true })
        .press("Enter");
      const customDialog = page.getByRole("dialog", { name: copy("profile.title"), exact: true });
      await expect(customDialog).toBeVisible();
      await customDialog.getByRole("button", { name: copy("profile.cancel"), exact: true }).press("Enter");
    }
    expectNoProblems(watch, state);
  }
});

test("S02 四个演示考试的首次与管理视图都能显示接口数据", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS.exams) {
    const fixture = JSON.parse(readFileSync(join(ROOT, `fixtures/pages/S02/${exam.exam_id}.json`), "utf8")) as {
      readonly choice: { readonly name: string };
    };
    for (const view of entry.views) {
      await watch.open(urlOf(entry, { exam: exam.key, view: view.key }));
      await expectLoaded(page, entry);
      if (view.key === "first")
        await expect(
          main(page)
            .getByRole("button", { name: copy("catalog.choose"), exact: true })
            .first(),
        ).toBeVisible();
      else {
        await expect(
          main(page)
            .getByRole("button", { name: copy("manage.edit"), exact: true })
            .first(),
        ).toBeVisible();
        await expect(main(page).getByRole("heading", { name: fixture.choice.name, exact: true }).first()).toBeVisible();
      }
      expectNoProblems(watch, "normal", `${exam.key}/${view.key}：`);
    }
  }
});

test("S02 官方库搜索、三条来路、确认画像和下一步可用", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const search = main(page).getByRole("searchbox", { name: copy("catalog.search"), exact: true });
  await search.fill("这里没有对应的考试");
  await expect(main(page)).toContainText(copy("catalog.no_results"));
  await search.fill("");
  await main(page)
    .getByRole("tab", { name: copy("tabs.template"), exact: true })
    .press("Enter");
  await expect(main(page).getByRole("tab", { name: copy("tabs.template"), exact: true })).toHaveAttribute("aria-selected", "true");
  await main(page)
    .getByRole("tab", { name: copy("tabs.custom"), exact: true })
    .press("Enter");
  await expect(main(page).getByRole("tab", { name: copy("tabs.custom"), exact: true })).toHaveAttribute("aria-selected", "true");
  await main(page)
    .getByRole("tab", { name: copy("tabs.official"), exact: true })
    .press("Enter");
  await main(page)
    .getByRole("button", { name: copy("catalog.choose"), exact: true })
    .first()
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("profile.title"), exact: true });
  await expect(dialog).toBeVisible();
  const subjectName = dialog.getByRole("textbox", { name: copy("profile.subject_name"), exact: true }).first();
  await subjectName.fill("调整后的备考科目");
  await expect(subjectName).toHaveValue("调整后的备考科目");
  await expect(dialog.getByLabel(copy("profile.date"), { exact: true })).toBeVisible();
  const rule = dialog.getByRole("combobox", { name: copy("profile.rule"), exact: true });
  await expect(rule.locator("option")).toHaveCount(4);
  await expect(dialog.getByLabel(copy("profile.score"), { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: copy("profile.cancel"), exact: true }).press("Enter");
  await expect(dialog).toBeHidden();
  await main(page)
    .getByRole("button", { name: copy("catalog.choose"), exact: true })
    .first()
    .press("Enter");
  const draftDialog = page.getByRole("dialog", { name: copy("profile.title"), exact: true });
  const editedSubject = "调整后的备考科目";
  const editedDate = "2027-06-18";
  const editedScore = "86";
  const editedFullScore = "120";
  await draftDialog
    .getByRole("textbox", { name: copy("profile.subject_name"), exact: true })
    .first()
    .fill(editedSubject);
  await draftDialog.getByLabel(copy("profile.date"), { exact: true }).fill(editedDate);
  await draftDialog.getByLabel(copy("profile.score"), { exact: true }).fill(editedScore);
  await draftDialog.getByText(copy("profile.details"), { exact: true }).press("Enter");
  await draftDialog.getByLabel(copy("profile.full_score"), { exact: true }).fill(editedFullScore);
  await draftDialog.getByRole("button", { name: copy("profile.next"), exact: true }).press("Enter");
  await expect(page).toHaveURL(new RegExp(`${pathTo("S03")}(?:\\?|$)`));
  const draft: unknown = await page.evaluate(() => (window.history.state as { usr?: { goal_draft?: unknown } } | null)?.usr?.goal_draft);
  expect(draft).toMatchObject({
    subjects: expect.arrayContaining([editedSubject]),
    target_date: editedDate,
    target_score: editedScore,
    full_score: editedFullScore,
  });
  expectNoProblems(watch, "normal");
});

test("S02 管理态可编辑目标或打开新增来路，未接通动作给出提示", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "manage" }));
  await expectLoaded(page, entry);
  await main(page)
    .getByRole("button", { name: copy("manage.edit"), exact: true })
    .first()
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("profile.title"), exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: copy("profile.cancel"), exact: true }).press("Enter");
  for (const action of ["pause", "archive", "primary", "passed_add", "inherit_action", "extension_action"]) {
    await main(page)
      .getByRole("button", { name: copy(`manage.${action}`), exact: true })
      .first()
      .press("Enter");
    await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
  }
  await main(page)
    .getByRole("button", { name: copy("manage.add"), exact: true })
    .press("Enter");
  await expect(main(page).getByRole("tab", { name: copy("tabs.official"), exact: true })).toBeVisible();
  expectNoProblems(watch, "normal");
});

test("S02 模板可挑内容，自建可填写草稿，AI 解析与自然语言入口有明确反馈", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  await main(page)
    .getByRole("textbox", { name: copy("catalog.natural"), exact: true })
    .fill("我想准备教师资格笔试");
  await main(page)
    .getByRole("button", { name: copy("catalog.natural_action"), exact: true })
    .press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
  await main(page)
    .getByRole("tab", { name: copy("tabs.template"), exact: true })
    .press("Enter");
  await main(page)
    .getByRole("checkbox", { name: copy("template.materials"), exact: true })
    .uncheck();
  await main(page)
    .getByRole("button", { name: copy("template.choose"), exact: true })
    .first()
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("profile.title"), exact: true });
  await expect(dialog).toContainText(copy("template.map"));
  await expect(dialog).toContainText(copy("template.questions"));
  await dialog.getByRole("button", { name: copy("profile.cancel"), exact: true }).press("Enter");
  await main(page)
    .getByRole("tab", { name: copy("tabs.custom"), exact: true })
    .press("Enter");
  const draft = "我的数据结构期末目标";
  await main(page).getByLabel(copy("custom.description"), { exact: true }).fill(draft);
  await main(page)
    .getByRole("button", { name: copy("custom.parse"), exact: true })
    .press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
  await main(page)
    .getByRole("button", { name: copy("custom.manual"), exact: true })
    .press("Enter");
  await expect(dialog.getByLabel(copy("profile.name"), { exact: true })).toHaveValue(draft);
  await dialog.getByText(copy("profile.details"), { exact: true }).press("Enter");
  await expect(dialog.getByLabel(copy("profile.full_score"), { exact: true })).toBeVisible();
  await dialog.getByLabel(copy("profile.full_score"), { exact: true }).fill("120");
  await expect(dialog).toContainText(copy("profile.assessment_hint"));
  await dialog.getByRole("button", { name: copy("profile.cancel"), exact: true }).press("Enter");
  expectNoProblems(watch, "normal");
});
