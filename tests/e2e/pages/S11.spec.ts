// S11 我的资料：五个视图、七态、三档宽度与导入向导的页面冒烟测试。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

type Copy = Readonly<Record<string, unknown>>;
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S11.json") as Copy;
const entry = pageById("S11");
const VIEWS = ["materials", "pending", "health", "inbox", "templates"] as const;
const EXAMS = (
  readJson("fixtures/exams/index.json") as {
    readonly exams: readonly { readonly key: string; readonly exam_id: string }[];
  }
).exams;

function nodeAt(path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((node, key) => (typeof node === "object" && node !== null ? (node as Copy)[key] : undefined), COPY);
}
function copy(path: string): string {
  const node = nodeAt(path);
  if (typeof node !== "string") throw new Error("S11.json 里没有文案 " + path);
  return node;
}
function main(page: Page) {
  return page.locator("main#main");
}
async function expectSoon(page: Page): Promise<void> {
  // 模态框打开时背景退出可访问树；关闭后核对提示仍可见。
  const dialog = page.getByRole("dialog").filter({ visible: true });
  if ((await dialog.count()) > 0) {
    await dialog.first().press("Escape");
    await expect(dialog).toHaveCount(0);
  }
  await expect(page.getByRole("status").filter({ hasText: copy("actions.soon") })).toBeVisible();
}
function title(page: Page) {
  return main(page).getByRole("heading", { level: 1, name: copy("title"), exact: true });
}
async function expectView(page: Page, view: (typeof VIEWS)[number]): Promise<void> {
  await expect(title(page)).toBeVisible();
  if (view !== "materials") await expect(main(page).getByRole("heading", { name: copy("views." + view), exact: true })).toBeVisible();
  await expect(main(page).getByRole("tab", { name: copy("tabs." + view), exact: false })).toHaveAttribute("aria-selected", "true");
}

for (const width of [375, 834, 1280]) {
  test("S11 " + width + " 宽：五视图显示完整，正文不横向溢出", async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const watch = await watchPage(page);
    for (const view of VIEWS) {
      await watch.open(urlOf(entry, { view }));
      await expectOpened(page, entry, undefined);
      await expectLoaded(page, entry);
      await expectView(page, view);
      await page.screenshot({ path: testInfo.outputPath("S11-" + view + "-" + width + ".png"), fullPage: true });
      expect(await main(page).evaluate((element) => element.scrollWidth - element.clientWidth), view + " 不应横向溢出").toBeLessThanOrEqual(
        1,
      );
      expectNoProblems(watch, "normal", view + "：");
    }
  });
}

test("S11 七态按页面规格显示，空态仍能添加资料", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectOpened(page, entry, undefined);
    await expectState(page, entry, state);
    const shown = main(page)
      .locator(".ui-state--" + state)
      .first();
    const stateCopy = nodeAt("state." + state);
    // 状态组件负责统一标题和动作；本页提供的正文必须实际显示。
    const body = typeof stateCopy === "object" && stateCopy !== null ? (stateCopy as Copy)["body"] : stateCopy;
    if (typeof body === "string") await expect(shown).toContainText(body);
    if (state === "empty") {
      await expect(title(page)).toBeVisible();
      await shown.getByRole("button", { name: copy("actions.add"), exact: true }).press("Enter");
      await expect(page.getByRole("dialog", { name: copy("import.title"), exact: true })).toBeVisible();
    }
    expectNoProblems(watch, state);
  }
});

test("S11 四个演示考试的资料都能打开", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectLoaded(page, entry);
    await expectView(page, "materials");
    const fixture = readJson("fixtures/pages/S11/" + exam.exam_id + ".json") as {
      readonly materials?: readonly { readonly material: { readonly title: string } }[];
    };
    const first = fixture.materials?.[0];
    if (first === undefined) throw new Error(exam.exam_id + " 的 S11 fixture 缺少示例资料");
    await expect(main(page).getByText(first.material.title, { exact: true }).first()).toBeVisible();
    expectNoProblems(watch, "normal", exam.key + "：");
  }
});

test("S11 五个标签支持键盘切换，并保留 view 参数", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  for (const view of VIEWS) {
    await main(page)
      .getByRole("tab", { name: copy("tabs." + view), exact: false })
      .press("Enter");
    await expectView(page, view);
    await expect.poll(() => new URL(page.url()).searchParams.get("view") ?? "materials").toBe(view);
  }
  expectNoProblems(watch, "normal");
});

test("S11 添加资料的四步向导：确认使用权后可预览、执行并查看结果", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  await main(page)
    .getByRole("button", { name: copy("actions.add"), exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("import.title"), exact: true });
  await expect(dialog).toBeVisible();
  const steps = nodeAt("import.steps");
  if (!Array.isArray(steps) || !steps.every((step: unknown) => typeof step === "string")) throw new Error("导入向导缺少四步文案");
  for (const step of steps as string[]) await expect(dialog).toContainText(step);
  const next = dialog.getByRole("button", { name: copy("import.next"), exact: true });
  await expect(next).toBeDisabled();
  await dialog.getByRole("button", { name: copy("import.example"), exact: true }).press("Enter");
  await expect(next).toBeDisabled();
  await dialog.getByRole("checkbox", { name: copy("import.rights"), exact: true }).check();
  await expect(next).toBeEnabled();
  await next.press("Enter");
  await dialog.getByRole("button", { name: copy("import.execute"), exact: true }).press("Enter");
  await dialog.getByRole("button", { name: copy("import.result"), exact: true }).press("Enter");
  await expect(dialog).toContainText(copy("actions.soon"));
  expectNoProblems(watch, "normal");
});

test("S11 主要业务入口可点击，尚未接通的写操作提示即将上线", async ({ page }) => {
  const watch = await watchPage(page);
  const actions = [
    { view: "pending", action: "accept_high" },
    { view: "inbox", action: "capture" },
    { view: "templates", action: "publish" },
    { view: "materials", action: "export" },
  ] as const;
  for (const action of actions) {
    await watch.open(urlOf(entry, { view: action.view }));
    await expectLoaded(page, entry);
    await main(page)
      .getByRole("button", { name: copy("actions." + action.action), exact: true })
      .first()
      .press("Enter");
    if (action.action === "capture") {
      const dialog = page.getByRole("dialog", { name: copy("inbox.capture_title"), exact: true });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("textbox", { name: copy("inbox.capture_label"), exact: true }).fill(copy("description"));
      await dialog.getByRole("button", { name: copy("inbox.capture_confirm"), exact: true }).press("Enter");
    }
    if (action.action === "publish") {
      const dialog = page.getByRole("dialog", { name: copy("templates.publish_title"), exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(copy("templates.boundary"));
      await dialog.getByRole("button", { name: copy("templates.publish_confirm"), exact: true }).press("Enter");
    }
    await expectSoon(page);
    expectNoProblems(watch, "normal", action.action + "：");
  }
});

test("S11 导入失败示例说明原因，重试后能回到解析预览并完成", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  await main(page)
    .getByRole("button", { name: copy("actions.add"), exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("import.title"), exact: true });
  await dialog.getByRole("button", { name: copy("import.example"), exact: true }).press("Enter");
  await dialog.getByRole("checkbox", { name: copy("import.rights"), exact: true }).check();
  await dialog.getByRole("button", { name: copy("import.next"), exact: true }).press("Enter");
  await dialog.getByRole("checkbox", { name: copy("import.failure_toggle"), exact: true }).check();
  await dialog.getByRole("button", { name: copy("import.execute"), exact: true }).press("Enter");
  await dialog.getByRole("button", { name: copy("import.result"), exact: true }).press("Enter");
  await expect(dialog).toContainText(copy("import.failure"));
  const fixture = readJson("fixtures/pages/S11/junior-accounting.json") as { readonly import_preview: { readonly failure_reason: string } };
  await expect(dialog).toContainText(copy("import.failure_reason").replace("{{reason}}", fixture.import_preview.failure_reason));
  await dialog.getByRole("button", { name: copy("import.retry"), exact: true }).press("Enter");
  await expect(dialog).toContainText(copy("import.preview_hint"));
  await expect(dialog.getByRole("checkbox", { name: copy("import.failure_toggle"), exact: true })).not.toBeChecked();
  await dialog.getByRole("button", { name: copy("import.execute"), exact: true }).press("Enter");
  await dialog.getByRole("button", { name: copy("import.result"), exact: true }).press("Enter");
  await expect(dialog).toContainText(copy("import.success_body"));
  await dialog.getByRole("button", { name: copy("import.done"), exact: true }).press("Enter");
  await expect(dialog).toBeHidden();
  expectNoProblems(watch, "normal");
});

test("S11 纸书与外部课程可登记目录，能选择据此生成新地图", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  for (const mode of ["mapped_only", "link_only"] as const) {
    await main(page)
      .getByRole("button", { name: copy("actions.add"), exact: true })
      .press("Enter");
    const dialog = page.getByRole("dialog", { name: copy("import.title"), exact: true });
    await dialog.getByRole("radio", { name: copy("access." + mode), exact: true }).press("Enter");
    await expect(dialog).toContainText(copy(mode === "mapped_only" ? "materials.no_text" : "materials.course"));
    const next = dialog.getByRole("button", { name: copy("import.next"), exact: true });
    await expect(next).toBeDisabled();
    const source = copy(mode === "mapped_only" ? "access.mapped_only" : "access.link_only");
    await dialog.getByRole("textbox", { name: copy("import.source"), exact: true }).fill(source);
    await dialog.getByRole("textbox", { name: copy("import.directory"), exact: true }).fill(copy("materials.outline"));
    await dialog.getByRole("checkbox", { name: copy("import.rights"), exact: true }).check();
    await dialog.getByRole("radio", { name: copy("import.new_map"), exact: true }).check();
    await next.press("Enter");
    await expect(dialog).toContainText(source);
    await expect(dialog).toContainText(copy("import.new_map"));
    await dialog.getByRole("button", { name: copy("import.back"), exact: true }).press("Enter");
    await expect(dialog.getByRole("textbox", { name: copy("import.source"), exact: true })).toHaveValue(source);
    await dialog.getByRole("button", { name: copy("import.cancel"), exact: true }).press("Enter");
    await expect(dialog).toBeHidden();
  }
  expectNoProblems(watch, "normal");
});

test("S11 整理、重新解析与增强资料保留确认入口", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  await main(page)
    .getByRole("button", { name: copy("actions.organize"), exact: true })
    .first()
    .press("Enter");
  let dialog = page.getByRole("dialog", { name: copy("organize.title"), exact: true });
  await expect(dialog).toContainText(copy("organize.move_hint"));
  await dialog.getByRole("textbox", { name: copy("organize.name"), exact: true }).fill(copy("actions.rename"));
  await dialog.getByRole("textbox", { name: copy("organize.destination"), exact: true }).fill(copy("actions.move"));
  await dialog.getByRole("button", { name: copy("actions.save"), exact: true }).press("Enter");
  await expectSoon(page);

  await main(page)
    .getByRole("button", { name: copy("actions.organize"), exact: true })
    .first()
    .press("Enter");
  dialog = page.getByRole("dialog", { name: copy("organize.title"), exact: true });
  await dialog.getByRole("button", { name: copy("actions.duplicate"), exact: true }).press("Enter");
  await expectSoon(page);

  for (const action of ["merge", "split"] as const) {
    await main(page)
      .getByRole("button", { name: copy("actions.reparse"), exact: true })
      .first()
      .press("Enter");
    dialog = page.getByRole("dialog", { name: copy("actions.reparse"), exact: true });
    await expect(dialog).toContainText(copy("materials.reparse_hint"));
    await dialog.getByRole("button", { name: copy("materials." + action), exact: true }).press("Enter");
    await expectSoon(page);
  }
  const kinds = nodeAt("organize.types");
  if (!Array.isArray(kinds) || kinds.length === 0) throw new Error("增强资料缺少素材类型");
  await main(page)
    .getByRole("button", { name: copy("actions.enhance"), exact: true })
    .first()
    .press("Enter");
  dialog = page.getByRole("dialog", { name: copy("actions.enhance"), exact: true });
  await expect(dialog).toContainText(copy("organize.enhance_hint"));
  for (const kind of kinds as string[]) await expect(dialog.getByRole("button", { name: kind, exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: kinds[0] as string, exact: true }).press("Enter");
  await expectSoon(page);
  expectNoProblems(watch, "normal");
});

test("S11 对齐审核可多选、修改知识点与关联类型，也可逐条拒绝", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "pending" }));
  await expectLoaded(page, entry);
  const fixture = readJson("fixtures/pages/S11/junior-accounting.json") as {
    readonly alignments: readonly { readonly segment: string; readonly disposition: string }[];
  };
  const row = fixture.alignments.find((item) => item.disposition === "pending");
  if (row === undefined) throw new Error("示例资料缺少待确认对齐");
  const selected = main(page).getByRole("button", { name: copy("actions.accept_selected"), exact: true });
  await expect(selected).toBeDisabled();
  await main(page)
    .getByRole("checkbox", { name: copy("pending.select").replace("{{segment}}", row.segment), exact: true })
    .check();
  await expect(selected).toBeEnabled();
  await selected.press("Enter");
  await expectSoon(page);
  await main(page)
    .getByRole("button", { name: copy("actions.edit"), exact: true })
    .first()
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("actions.edit"), exact: true });
  await dialog.getByRole("textbox", { name: copy("pending.point_edit"), exact: true }).fill(copy("pending.point"));
  await dialog.getByRole("combobox", { name: copy("pending.relation_edit"), exact: true }).selectOption("exercise");
  await dialog.getByRole("button", { name: copy("actions.confirm"), exact: true }).press("Enter");
  await expectSoon(page);
  await main(page)
    .getByRole("button", { name: copy("actions.reject"), exact: true })
    .first()
    .press("Enter");
  await expectSoon(page);
  expectNoProblems(watch, "normal");
});

test("S11 回归：纸书导入返回选择步骤时保留资料类型与目录", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  await main(page)
    .getByRole("button", { name: copy("actions.add"), exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("import.title"), exact: true });
  await dialog.getByRole("radio", { name: copy("access.mapped_only"), exact: true }).press("Enter");
  const kinds = nodeAt("import.types");
  if (!Array.isArray(kinds) || typeof kinds[8] !== "string") throw new Error("S11 资料类型缺少书号");
  const kind = kinds[8] as string;
  const fixture = readJson("fixtures/pages/S11/junior-accounting.json") as {
    readonly materials: readonly { readonly material: { readonly title: string }; readonly location: string }[];
  };
  const paper = fixture.materials[0];
  if (paper === undefined) throw new Error("S11 缺少纸书示例");
  const type = dialog.getByRole("combobox", { name: copy("import.type"), exact: true });
  const source = dialog.getByRole("textbox", { name: copy("import.source"), exact: true });
  const directory = dialog.getByRole("textbox", { name: copy("import.directory"), exact: true });
  await type.selectOption({ label: kind });
  await source.fill(paper.material.title);
  await directory.fill(paper.location);
  await dialog.getByRole("checkbox", { name: copy("import.rights"), exact: true }).check();
  await dialog.getByRole("button", { name: copy("import.next"), exact: true }).press("Enter");
  await expect(dialog).toContainText(copy("import.preview_hint"));
  await dialog.getByRole("button", { name: copy("import.back"), exact: true }).press("Enter");
  await expect(type).toHaveValue(kind);
  await expect(source).toHaveValue(paper.material.title);
  await expect(directory).toHaveValue(paper.location);
  expectNoProblems(watch, "normal");
});

test("S11 回归：关闭整理后切换资料不会沿用上次填写的目标", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const fixture = readJson("fixtures/pages/S11/junior-accounting.json") as {
    readonly materials: readonly { readonly material: { readonly title: string }; readonly subject: string }[];
  };
  const first = fixture.materials[0];
  const second = fixture.materials[1];
  if (first === undefined || second === undefined) throw new Error("S11 缺少两份资料示例");
  await main(page)
    .getByRole("row")
    .filter({ hasText: first.material.title })
    .getByRole("button", { name: copy("actions.organize"), exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("organize.title"), exact: true });
  await dialog.getByRole("textbox", { name: copy("organize.destination"), exact: true }).fill("临时目标");
  await dialog.press("Escape");
  await expect(dialog).toBeHidden();
  await main(page)
    .getByRole("row")
    .filter({ hasText: second.material.title })
    .getByRole("button", { name: copy("actions.organize"), exact: true })
    .press("Enter");
  await expect(dialog.getByRole("textbox", { name: copy("organize.name"), exact: true })).toHaveValue(second.material.title);
  await expect(dialog.getByRole("textbox", { name: copy("organize.destination"), exact: true })).toHaveValue(second.subject);
  expectNoProblems(watch, "normal");
});
