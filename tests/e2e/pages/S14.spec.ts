// S14 本页冒烟：所有视图、七态、三档宽度、演示考试、筛选和确认前预览。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator } from "@playwright/test";
import type { S14Notebook } from "../../../packages/contract/src/index.ts";
import { pathTo } from "../../../apps/learner/src/routes.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const readJson = (path: string): unknown => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S14.json");
const ENTRY = pageById("S14");
const EXAMS = (readJson("fixtures/exams/index.json") as { exams: { key: string; exam_id: string }[] }).exams;
const VIEWS = ["notes", "favorites", "handbook", "paper"] as const;
const KJ = readJson("fixtures/pages/S14/junior-accounting.json") as S14Notebook;

function copy(path: string, values: Readonly<Record<string, string | number>> = {}): string {
  let value: unknown = COPY;
  for (const key of path.split("."))
    value = value !== null && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
  if (typeof value !== "string") throw new Error("S14 文案不存在：" + path);
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole: string, key: string) => (values[key] === undefined ? whole : String(values[key])));
}

function firstNote(data: S14Notebook) {
  const first = data.notes[0];
  if (first === undefined) throw new Error("演示笔记为空");
  return first;
}

async function boxOf(target: Locator) {
  const box = await target.boundingBox();
  if (box === null) throw new Error("元素不可见，无法检查布局");
  return box;
}

for (const width of [375, 834, 1280]) {
  test("S14 " + width + " 宽：四个视图都能打开，正文不横向溢出", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const watch = await watchPage(page);
    for (const view of VIEWS) {
      await watch.open(urlOf(ENTRY, { view }));
      await expectOpened(page, ENTRY, undefined);
      await expectLoaded(page, ENTRY);
      await expect(page.getByRole("tab", { name: copy("tabs." + view), exact: true })).toHaveAttribute("aria-selected", "true");
      const main = page.locator("main#main");
      if (view === "notes") {
        await expect(main.getByRole("heading", { name: firstNote(KJ).note.title, exact: true })).toBeVisible();
        const primary = await boxOf(main.locator(".ui-cols__main"));
        const aside = await boxOf(main.locator(".ui-cols__aside"));
        if (width === 1280) expect(aside.x).toBeGreaterThanOrEqual(primary.x + primary.width - 1);
        else expect(aside.y).toBeGreaterThanOrEqual(primary.y + primary.height - 1);
      } else {
        const title = view === "favorites" ? copy("favorites.title") : KJ[view].title;
        await expect(main.getByRole("heading", { name: title, exact: true })).toBeVisible();
      }
      expect(await main.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      expectNoProblems(watch, "normal", view + "：");
    }
  });
}

test("S14 七态按原型显示；AI 受限时仍可手写，数据不足时给模板", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(ENTRY, { state }));
    await expectState(page, ENTRY, state);
    const shown = page.locator("main#main .ui-state--" + state).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.title"));
      await expect(shown).toContainText(copy("state.empty.body"));
      await expect(shown.getByRole("button", { name: copy("actions.new"), exact: true })).toBeVisible();
    }
    if (state === "error") await expect(shown).toContainText(copy("state.error.body"));
    if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
    if (state === "restricted") {
      await expect(shown).toContainText(copy("state.restricted.body"));
      await expect(page.getByRole("button", { name: copy("actions.organize"), exact: true })).toBeDisabled();
      await page
        .locator("main#main")
        .getByRole("button", { name: copy("actions.new"), exact: true })
        .press("Enter");
      const dialog = page.getByRole("dialog", { name: copy("editor.title"), exact: true });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: copy("actions.cancel"), exact: true }).press("Enter");
    }
    if (state === "insufficient_data") {
      await expect(shown).toContainText(copy("state.insufficient.body"));
      await page.getByRole("tab", { name: copy("tabs.paper"), exact: true }).press("Enter");
      await expect(page.getByRole("heading", { name: copy("compilation.templateTitle"), exact: true })).toBeVisible();
      await expect(page.locator("main#main").getByRole("button", { name: copy("compilation.confirm"), exact: true })).toHaveCount(0);
    }
    expectNoProblems(watch, state);
  }
});

test("S14 四个演示考试均显示各自笔记和完整性计数", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    const data = readJson("fixtures/pages/S14/" + exam.exam_id + ".json") as S14Notebook;
    await watch.open(urlOf(ENTRY, { exam: exam.key }));
    await expectLoaded(page, ENTRY);
    await expect(page.locator("main#main").getByRole("heading", { name: firstNote(data).note.title, exact: true })).toBeVisible();
    await expect(page.locator("main#main")).toContainText(
      copy("integrity.coverage", { covered: data.integrity.covered, total: data.integrity.total }),
    );
    expectNoProblems(watch, "normal", exam.key + "：");
  }
});

test("S14 全文、来源、类型、科目和时间筛选均可使用", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(ENTRY));
  await expectLoaded(page, ENTRY);
  const main = page.locator("main#main");
  const first = KJ.notes[0];
  if (first === undefined) throw new Error("示例笔记为空");
  await main.getByLabel(copy("filter.search"), { exact: true }).fill(first.note.title);
  await expect(main.getByRole("heading", { name: first.note.title, exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: copy("actions.open"), exact: true })).toHaveCount(1);
  await expect(main.getByLabel(copy("filter.search"), { exact: true })).toBeFocused();
  await main.getByRole("button", { name: copy("actions.clear"), exact: true }).press("Enter");
  await main.getByLabel(copy("filter.source"), { exact: true }).selectOption(first.source);
  await main.getByLabel(copy("filter.subject"), { exact: true }).selectOption(first.subject);
  await main.getByRole("button", { name: copy("type." + first.note.note_type), exact: true }).press("Enter");
  await expect(main.getByRole("heading", { name: first.note.title, exact: true })).toBeVisible();
  await main.getByLabel(copy("filter.since"), { exact: true }).fill("2099-01-01");
  await expect(main.getByRole("heading", { name: copy("filter.noResults"), exact: true })).toBeVisible();
  await main
    .getByRole("button", { name: copy("actions.clear"), exact: true })
    .first()
    .press("Enter");
  await expect(main.getByRole("button", { name: copy("actions.open"), exact: true })).toHaveCount(KJ.notes.length);
  expectNoProblems(watch, "normal");
});

test("S14 笔记编辑、搬运提醒与编辑工具均可达，保存提示即将上线", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(ENTRY));
  await expectLoaded(page, ENTRY);
  const main = page.locator("main#main");
  await main
    .getByRole("button", { name: copy("actions.open"), exact: true })
    .first()
    .press("Enter");
  let dialog = page.getByRole("dialog", { name: copy("editor.title"), exact: true });
  await expect(dialog).toContainText(copy("editor.copyBody"));
  await expect(dialog.getByLabel(copy("editor.name"), { exact: true })).toHaveValue(KJ.notes[0]?.note.title ?? "");
  await dialog.getByLabel(copy("editor.point"), { exact: true }).fill("我的知识点归属");
  await dialog.getByRole("button", { name: copy("actions.cancel"), exact: true }).press("Enter");
  await main.getByRole("button", { name: copy("actions.new"), exact: true }).press("Enter");
  dialog = page.getByRole("dialog", { name: copy("editor.title"), exact: true });
  await dialog.getByLabel(copy("editor.name"), { exact: true }).fill("用自己的话理解");
  await dialog.getByRole("textbox", { name: copy("editor.body"), exact: true }).fill("我先回忆，再核对。");
  await dialog.getByRole("button", { name: copy("editor.slash"), exact: true }).press("Enter");
  await expect(dialog.getByRole("button", { name: copy("editor.slash"), exact: true })).toHaveAttribute("aria-expanded", "true");
  await dialog.getByRole("button", { name: copy("editor.slash"), exact: true }).press("Enter");
  for (const tool of ["formula", "table", "image", "drawing"]) {
    await dialog.getByRole("button", { name: copy("editor." + tool), exact: true }).press("Enter");
    await expect(page.getByRole("status").filter({ hasText: copy("editor.toolSoon", { tool: copy("editor." + tool) }) })).toBeVisible();
  }
  await dialog.getByRole("button", { name: copy("actions.save"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: copy("actions.cancel"), exact: true }).press("Enter");
  await expect(main.getByRole("button", { name: copy("actions.open"), exact: true })).toHaveCount(KJ.notes.length);
  expectNoProblems(watch, "normal");
});

test("S14 多选转卡片、转自测题和 AI 整理均先预览，确认前不写入", async ({ page }) => {
  const watch = await watchPage(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/") && request.method() !== "GET") writes.push(request.method() + " " + request.url());
  });
  await watch.open(urlOf(ENTRY));
  await expectLoaded(page, ENTRY);
  const main = page.locator("main#main");
  const first = KJ.notes[0];
  if (first === undefined) throw new Error("示例笔记为空");
  await main.getByRole("checkbox", { name: copy("list.select", { title: first.note.title }), exact: true }).check();
  for (const [action, title] of [
    ["cards", "title"],
    ["questions", "questionTitle"],
  ]) {
    await main.getByRole("button", { name: copy("actions." + action), exact: true }).press("Enter");
    const dialog = page.getByRole("dialog", { name: copy("conversion." + title), exact: true });
    await expect(dialog).toContainText(copy("conversion.pending"));
    await expect(dialog).toContainText(first.preview.front);
    await dialog.getByRole("button", { name: copy("actions.confirmQueue"), exact: true }).press("Enter");
    await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
    await dialog.getByRole("button", { name: copy("actions.cancel"), exact: true }).press("Enter");
  }
  await main.getByRole("button", { name: copy("actions.organize"), exact: true }).press("Enter");
  const organized = page.getByRole("dialog", { name: copy("organize.title"), exact: true });
  await expect(organized).toContainText(copy("organize.pending"));
  await expect(organized).toContainText(copy("exportDialog.ai"));
  await organized.getByRole("button", { name: copy("actions.confirm"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
  await organized.getByRole("button", { name: copy("actions.cancel"), exact: true }).press("Enter");
  await expect(main.getByRole("button", { name: copy("actions.open"), exact: true })).toHaveCount(KJ.notes.length);
  expect(writes).toEqual([]);
  expectNoProblems(watch, "normal");
});

test("S14 章节导图可遮挡回忆，收藏组卷与汇编确认有明确反馈", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(ENTRY));
  await expectLoaded(page, ENTRY);
  const main = page.locator("main#main");
  await main.getByRole("button", { name: copy("actions.map"), exact: true }).press("Enter");
  const map = page.getByRole("dialog", { name: copy("actions.map"), exact: true });
  await expect(map).toBeVisible();
  await map
    .getByRole("button", { name: copy("integrity.hide"), exact: true })
    .first()
    .press("Enter");
  await expect(map.getByRole("button", { name: copy("integrity.show"), exact: true }).first()).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Escape");
  await expect(map).toBeHidden();
  await expect(main.getByRole("link", { name: copy("actions.recite"), exact: true })).toHaveAttribute("href", pathTo("S16"));
  await page.getByRole("tab", { name: copy("tabs.favorites"), exact: true }).press("Enter");
  await main.getByRole("button", { name: copy("actions.createExam"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
  await page.getByRole("tab", { name: copy("tabs.handbook"), exact: true }).press("Enter");
  await main.getByRole("button", { name: copy("compilation.confirm"), exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
  expectNoProblems(watch, "normal");
});

test("S14 通用文本导出保留 AI 生成标识，打印入口可用", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(ENTRY));
  await expectLoaded(page, ENTRY);
  await page.evaluate(() => {
    (window as unknown as { __s14Printed?: boolean }).__s14Printed = false;
    window.print = () => {
      (window as unknown as { __s14Printed?: boolean }).__s14Printed = true;
    };
  });
  await page
    .locator("main#main")
    .getByRole("button", { name: copy("actions.export"), exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("exportDialog.title"), exact: true });
  const downloading = page.waitForEvent("download");
  await dialog.getByRole("button", { name: copy("exportDialog.download"), exact: true }).press("Enter");
  const download = await downloading;
  const path = await download.path();
  if (path === null) throw new Error("导出文件不可读取");
  const text = readFileSync(path, "utf8");
  expect(text).toContain(copy("exportDialog.ai"));
  const generated = KJ.notes.find((item) => item.note.ai_generated);
  if (generated === undefined) throw new Error("演示数据没有 AI 笔记");
  expect(text).toContain(generated.note.title);
  await dialog.getByRole("button", { name: copy("actions.print"), exact: true }).press("Enter");
  expect(await page.evaluate(() => (window as unknown as { __s14Printed?: boolean }).__s14Printed)).toBe(true);
  expectNoProblems(watch, "normal");
});

test("S14 切换最后一页纸篇幅后，导出只包含当前篇幅的预览内容", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(ENTRY, { view: "paper" }));
  await expectLoaded(page, ENTRY);
  const main = page.locator("main#main");
  const selected = KJ.paper.lengths.find((item) => item.id === "standard");
  if (selected === undefined) throw new Error("演示数据没有标准版篇幅");
  const option = main.getByRole("radio", { name: selected.label, exact: true });
  await option.press("Enter");
  await expect(option).toHaveAttribute("aria-checked", "true");
  for (const section of selected.sections) {
    await expect(main.getByRole("heading", { name: section.title, exact: true })).toBeVisible();
  }
  const absent = KJ.paper.sections.filter((section) => !selected.sections.some((item) => item.id === section.id));
  for (const section of absent) {
    await expect(main.getByRole("heading", { name: section.title, exact: true })).toHaveCount(0);
  }
  await main.getByRole("button", { name: copy("actions.export"), exact: true }).press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("exportDialog.title"), exact: true });
  const downloading = page.waitForEvent("download");
  await dialog.getByRole("button", { name: copy("exportDialog.download"), exact: true }).press("Enter");
  const path = await (await downloading).path();
  if (path === null) throw new Error("导出文件不可读取");
  const text = readFileSync(path, "utf8");
  expect(text).toContain(copy("exportDialog.ai"));
  for (const section of selected.sections) {
    expect(text).toContain(section.title);
    expect(text).toContain(section.body);
  }
  for (const section of absent) expect(text).not.toContain(section.title);
  expectNoProblems(watch, "normal");
});
