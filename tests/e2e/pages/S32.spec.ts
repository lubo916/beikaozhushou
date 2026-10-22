// S32 数据与隐私：所有视图、三档布局、七态、四个演示考试和导出确认流程。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const COPY: unknown = JSON.parse(readFileSync(join(ROOT, "apps/learner/src/i18n/zh-CN/S32.json"), "utf8"));
const EXAMS = JSON.parse(readFileSync(join(ROOT, "fixtures/exams/index.json"), "utf8")) as {
  readonly exams: readonly { readonly key: string }[];
};
const entry = pageById("S32");
const VIEWS = ["privacy", "assets", "account"] as const;

function copy(path: string): string {
  let value: unknown = COPY;
  for (const key of path.split("."))
    value = typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  if (typeof value !== "string") throw new Error(`S32.json 里没有文案 ${path}`);
  return value;
}

function pattern(path: string): RegExp {
  const escaped = copy(path).replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  return new RegExp(escaped.replace(/\\{\\{\s*\w+\s*\\}\\}/g, ".+"));
}

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.first().boundingBox();
  if (box === null) throw new Error("元素没有显示出来，量不到位置");
  return box;
}

for (const size of [
  { width: 375, height: 812, split: false },
  { width: 834, height: 900, split: false },
  { width: 1280, height: 900, split: true },
]) {
  test(`S32 ${size.width} 宽：所有视图布局正确且正文不横向溢出`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const watch = await watchPage(page);
    for (const view of VIEWS) {
      await watch.open(urlOf(entry, { view }));
      await expectOpened(page, entry, undefined);
      await expectLoaded(page, entry);
      await expect(page.getByRole("heading", { level: 1, name: copy("title"), exact: true })).toHaveCount(1);
      const main = await boxOf(page.locator("main#main .ui-cols__main"));
      const aside = await boxOf(page.locator("main#main .ui-cols__aside"));
      if (size.split) expect(aside.x, `${view}：桌面右栏在主栏右侧`).toBeGreaterThanOrEqual(main.x + main.width - 1);
      else expect(aside.y, `${view}：窄屏右栏排到主栏下方`).toBeGreaterThanOrEqual(main.y + main.height - 1);
      const overflow = await page.locator("main#main").evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(overflow, `${view}：正文不横向溢出`).toBeLessThanOrEqual(1);
      expectNoProblems(watch, "normal", `${view}：`);
      await page.screenshot({ path: testInfo.outputPath(view + "-" + size.width + ".png"), fullPage: true });
    }
  });
}

for (const view of VIEWS) {
  test(`S32 ?view=${view} 可直接打开，标签能切换到其他视图`, async ({ page }) => {
    const watch = await watchPage(page);
    await watch.open(urlOf(entry, { view }));
    await expectLoaded(page, entry);
    const main = page.locator("main#main");
    await expect(main.getByRole("tab", { name: copy(`tabs.${view}`), exact: true })).toHaveAttribute("aria-selected", "true");
    for (const next of VIEWS) {
      const tab = main.getByRole("tab", { name: copy(`tabs.${next}`), exact: true });
      await tab.press("Enter");
      await expect(tab).toHaveAttribute("aria-selected", "true");
    }
    expectNoProblems(watch, "normal");
  });
}

for (const state of ABNORMAL_STATES) {
  test(`S32 ?state=${state} 显示原型约定的状态`, async ({ page }) => {
    const watch = await watchPage(page);
    const view = state === "restricted" ? "account" : "privacy";
    await watch.open(urlOf(entry, { view, state }));
    await expectState(page, entry, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.title"));
      await expect(shown).toContainText(copy("state.empty.body"));
      await expect(page.getByRole("heading", { level: 1, name: copy("title"), exact: true })).toBeVisible();
      await expect(page.locator("main#main").getByRole("tablist")).toBeVisible();
    }
    if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
    if (state === "restricted") {
      await expect(shown).toContainText(copy("state.restricted.title"));
      await expect(shown).toContainText(pattern("state.restricted.body"));
      await expect(page.getByRole("heading", { name: copy("account.devices.title"), exact: true })).toBeVisible();
    }
    if (state === "insufficient_data") {
      await expect(shown).toContainText(copy("state.insufficient_data.body"));
      await expect(page.locator("main#main .ui-cols__main")).toBeVisible();
    }
    expectNoProblems(watch, state);
  });
}

test("S32 四个演示考试都能打开本页", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS.exams) {
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectLoaded(page, entry);
    await expect(page.getByRole("heading", { level: 1, name: copy("title"), exact: true })).toBeVisible();
    expectNoProblems(watch, "normal", `${exam.key}：`);
  }
});

test("S32 导出前可分别选择个人数据，确认后给出演示反馈", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  await page
    .locator("main#main .ui-pagehead")
    .getByRole("button", { name: copy("export.all"), exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("export.title"), exact: true });
  await expect(dialog).toBeVisible();
  for (const option of ["annotations", "notes", "relations", "records"]) {
    const checkbox = dialog.getByRole("checkbox", { name: copy(`export.options.${option}`), exact: true });
    await expect(checkbox).toBeVisible();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
  }
  await dialog.getByRole("button", { name: copy("export.confirm"), exact: true }).press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: copy("common.soon") })).toBeVisible();
  expectNoProblems(watch, "normal");
});

/** 演示操作只作说明与反馈，确认后不能悄悄改掉页面里的授权、设备或资产。 */
function writeRequests(page: Page): string[] {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/") && request.method() !== "GET") {
      writes.push(request.method() + " " + request.url());
    }
  });
  return writes;
}

function cardOf(page: Page, titleKey: string): Locator {
  return page.locator("main#main").getByRole("region", { name: copy(titleKey), exact: true });
}

function buttonOf(scope: Locator, key: string): Locator {
  return scope.getByRole("button", { name: copy(key), exact: true }).first();
}

async function expectSoon(page: Page): Promise<void> {
  await expect(page.getByRole("status").filter({ hasText: copy("common.soon") })).toBeVisible();
}

async function confirmAndKeep(page: Page, target: Locator, kind: string, unchanged: Locator): Promise<void> {
  const before = await unchanged.innerText();
  await target.press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("confirm." + kind + ".title"), exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(pattern("confirm." + kind + ".body"));
  await dialog.getByRole("button", { name: copy("common.confirm"), exact: true }).press("Enter");
  await expect(dialog).toBeHidden();
  await expectSoon(page);
  expect(await unchanged.innerText(), "演示确认后原数据应保留").toBe(before);
}

test("S32 机构授权先确认且可取消，设置开关与导师记忆删除只给出演示反馈", async ({ page }) => {
  const watch = await watchPage(page);
  const writes = writeRequests(page);
  await watch.open(urlOf(entry, { view: "privacy" }));
  await expectLoaded(page, entry);
  const organization = cardOf(page, "privacy.organization.title");
  await expect(organization.getByRole("switch")).toHaveCount(3);
  const firstGrant = organization.getByRole("switch", { name: copy("privacy.organization.progress"), exact: true });
  const original = await organization.innerText();
  await expect(firstGrant).toHaveAttribute("aria-checked", "false");
  await firstGrant.press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("confirm.authorization.title"), exact: true });
  await expect(dialog).toContainText(pattern("confirm.authorization.body"));
  await dialog.getByRole("button", { name: copy("common.cancel"), exact: true }).press("Enter");
  await expect(dialog).toBeHidden();
  expect(await organization.innerText(), "取消授权变更后应保留原数据").toBe(original);
  for (const key of ["progress", "mistakes", "notes"]) {
    const toggle = organization.getByRole("switch", { name: copy("privacy.organization." + key), exact: true });
    await confirmAndKeep(page, toggle, "authorization", organization);
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  }

  const settings = cardOf(page, "privacy.settings.title");
  for (const key of ["analysis", "carryover", "allocation", "training"]) {
    const toggle = settings.getByRole("switch", { name: copy("privacy.settings." + key), exact: true });
    const checked = await toggle.getAttribute("aria-checked");
    await confirmAndKeep(page, toggle, "setting", settings);
    await expect(toggle).toHaveAttribute("aria-checked", checked ?? "false");
  }
  const memory = cardOf(page, "privacy.tutor.memory");
  await confirmAndKeep(page, buttonOf(memory, "privacy.tutor.delete_memory"), "delete_memory", memory);
  expect(writes, "假数据阶段不应发起真实授权或删除请求").toEqual([]);
  expectNoProblems(watch, "normal");
});

test("S32 学习资产的重试、覆盖、恢复、删除及分享撤销均先说明后果再确认", async ({ page }) => {
  const watch = await watchPage(page);
  const writes = writeRequests(page);
  await watch.open(urlOf(entry, { view: "assets" }));
  await expectLoaded(page, entry);
  const tasks = cardOf(page, "assets.tasks.title");
  await confirmAndKeep(page, buttonOf(tasks, "assets.tasks.import"), "import", tasks);
  await confirmAndKeep(page, buttonOf(tasks, "assets.tasks.retry"), "import", tasks);
  await confirmAndKeep(page, buttonOf(tasks, "assets.tasks.replace"), "replace", tasks);
  await buttonOf(tasks, "assets.tasks.result").press("Enter");
  await expectSoon(page);

  const recycle = cardOf(page, "assets.recycle.title");
  await confirmAndKeep(page, buttonOf(recycle, "assets.recycle.restore"), "restore", recycle);
  await confirmAndKeep(page, buttonOf(recycle, "assets.recycle.delete"), "delete", recycle);
  await confirmAndKeep(page, buttonOf(recycle, "assets.recycle.bulk"), "bulk", recycle);

  const shares = cardOf(page, "assets.shares.title");
  await confirmAndKeep(page, buttonOf(shares, "assets.shares.preview"), "import", shares);
  await confirmAndKeep(page, buttonOf(shares, "assets.shares.revoke"), "revoke", shares);
  await buttonOf(shares, "assets.shares.create").press("Enter");
  await expectSoon(page);
  expect(writes, "假数据阶段不应发起真实导入、恢复、删除或撤销请求").toEqual([]);
  expectNoProblems(watch, "normal");
});

test("S32 操作历史可按安全、设备、导入、删除、订购筛选且能返回全部", async ({ page }) => {
  const data = JSON.parse(readFileSync(join(ROOT, "fixtures/pages/S32/junior-accounting.json"), "utf8")) as {
    readonly activities: readonly { readonly kind: string; readonly event: string }[];
  };
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "assets", exam: "kj" }));
  await expectLoaded(page, entry);
  const activity = cardOf(page, "assets.activity.title");
  for (const kind of ["security", "device", "import", "delete", "order", "all"]) {
    const filter = buttonOf(activity, "assets.activity.kind." + kind);
    await filter.press("Enter");
    await expect(filter).toHaveAttribute("aria-pressed", "true");
    for (const item of data.activities) {
      const event = activity.getByText(copy("assets.activity.event." + item.event), { exact: true });
      if (kind === "all" || item.kind === kind) await expect(event).toBeVisible();
      else await expect(event).toHaveCount(0);
    }
  }
  expectNoProblems(watch, "normal");
});

test("S32 设备下线、异地登录确认与注销均二次确认，历史记录和改密给出演示反馈", async ({ page }) => {
  const watch = await watchPage(page);
  const writes = writeRequests(page);
  await watch.open(urlOf(entry, { view: "account" }));
  await expectLoaded(page, entry);
  const devices = cardOf(page, "account.devices.title");
  const offlineButtons = devices.getByRole("button", { name: copy("account.devices.offline"), exact: true });
  const count = await offlineButtons.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await confirmAndKeep(page, offlineButtons.nth(index), "offline", devices);
  }
  await confirmAndKeep(page, buttonOf(devices, "account.devices.all"), "all_offline", devices);

  const alert = cardOf(page, "account.alert.title");
  await confirmAndKeep(page, buttonOf(alert, "account.alert.mine"), "mine", alert);
  await confirmAndKeep(page, buttonOf(alert, "account.alert.not_mine"), "not_mine", alert);
  const deregister = cardOf(page, "account.deregister.title");
  await confirmAndKeep(page, buttonOf(deregister, "account.deregister.action"), "deregister", deregister);

  const logins = cardOf(page, "account.logins.title");
  const before = await logins.innerText();
  await buttonOf(logins, "account.logins.earlier").press("Enter");
  await expectSoon(page);
  expect(await logins.innerText(), "加载更早记录的演示反馈不应伪造新记录").toBe(before);
  await buttonOf(cardOf(page, "account.security.title"), "account.security.password").press("Enter");
  await expectSoon(page);
  await expect(cardOf(page, "account.minor.title").getByRole("link", { name: copy("common.settings"), exact: true })).toHaveAttribute(
    "href",
    pageById("S33").path,
  );
  expect(writes, "假数据阶段不应发起真实设备下线、改密或注销请求").toEqual([]);
  expectNoProblems(watch, "normal");
});
