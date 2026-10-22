// S01 欢迎与登录：全视图、七态、三档布局、四个演示考试与主要入口。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { pathTo } from "../../../apps/learner/src/routes.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

const entry = pageById("S01");
const COPY = JSON.parse(readFileSync(join(ROOT, "apps/learner/src/i18n/zh-CN/S01.json"), "utf8")) as unknown;
const EXAMS = ["kj", "js", "en", "ds"] as const;
const WIDTHS = [375, 834, 1280] as const;

function copy(path: string): string {
  let item: unknown = COPY;
  for (const key of path.split(".")) item = typeof item === "object" && item !== null ? (item as Record<string, unknown>)[key] : undefined;
  if (typeof item !== "string") throw new Error(`S01.json 中缺少文案 ${path}`);
  return item;
}

function main(page: Page) {
  return page.locator("main#main");
}

for (const width of WIDTHS) {
  for (const view of entry.views) {
    test(`S01 ${view.key} 视图在 ${width} 宽独立显示，无横向溢出`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const watch = await watchPage(page);
      await watch.open(urlOf(entry, { view: view.key }));
      await expectOpened(page, entry, view);
      await expect(main(page).locator("h1").first()).toBeVisible();
      await expect(main(page).locator(".ui-state--loading")).toHaveCount(0);
      await expect(page.locator("nav").filter({ visible: true })).toHaveCount(0);
      expect(await main(page).evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      if (view.key === "first") await expect(main(page).locator('input[type="tel"]')).toHaveCount(0);
      if (view.key === "back") await expect(main(page).locator('input[type="tel"]').first()).toBeVisible();
      expectNoProblems(watch, "normal");
    });
  }
}

test("S01 七态可强制，首次进入的空态和数据不足仍可继续欢迎流程", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    if (state === "empty" || state === "insufficient_data") await expect(main(page).getByRole("radio").first()).toBeVisible();
    expectNoProblems(watch, state);
  }
});

test("S01 四个演示考试都能打开欢迎页", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    await watch.open(urlOf(entry, { exam }));
    await expectOpened(page, entry, entry.views[0]);
    await expect(main(page).getByRole("radio").first()).toBeVisible();
    expectNoProblems(watch, "normal");
  }
});

function named(path: string): RegExp {
  return new RegExp(copy(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

async function toastAfter(page: Page, target: Locator, text = copy("soon")): Promise<void> {
  await target.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: text }).last()).toBeVisible();
}

test("S01 游客先确认年龄，成年后不注册即可前往备考目标", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  const radios = main(page).getByRole("radio");
  await expect(radios).toHaveCount(3);
  await expect(main(page).locator('input[type="radio"]:checked')).toHaveCount(0);
  const guest = main(page).getByRole("button", { name: copy("welcome.guest"), exact: true });
  await guest.press("Enter");
  await expect(main(page).getByText(copy("age.required"), { exact: true })).toBeVisible();
  await main(page)
    .getByRole("radio", { name: named("age.adult.label") })
    .check();
  await guest.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${pathTo("S02")}(?:[?#]|$)`));
  expectNoProblems(watch, "normal");
});

test("S01 未成年明确提示保护模式，未到服务最低年龄不能开始体验", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await main(page)
    .getByRole("radio", { name: named("age.minor.label") })
    .check();
  await expect(main(page).getByText(copy("age.minorNotice"), { exact: true })).toBeVisible();
  await main(page)
    .getByRole("radio", { name: named("age.under_minimum.label") })
    .check();
  await expect(main(page).getByText(copy("age.blocked"), { exact: true })).toBeVisible();
  await expect(main(page).getByRole("button", { name: copy("welcome.guest"), exact: true })).toBeDisabled();
  expectNoProblems(watch, "normal");
});

test("S01 回访登录独立成页，协议与隐私分别同意，验证码和密码方式可切换", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "back" }));
  const form = main(page);
  await expect(form.getByRole("heading", { name: copy("login.title"), exact: true })).toBeVisible();
  await expect(form.getByRole("checkbox")).toHaveCount(2);
  await expect(form.locator('input[type="checkbox"]:checked')).toHaveCount(0);
  await form.getByLabel(copy("login.phone"), { exact: true }).fill("13800000000");
  await toastAfter(page, form.getByRole("button", { name: copy("login.send"), exact: true }));
  await form.getByLabel(copy("login.code"), { exact: true }).fill("123456");
  await form.getByRole("button", { name: copy("login.submit"), exact: true }).press("Enter");
  await expect(form.getByText(copy("login.consentRequired"), { exact: true })).toBeVisible();
  await form.getByRole("checkbox", { name: named("login.terms") }).check();
  await form.getByRole("button", { name: copy("login.submit"), exact: true }).press("Enter");
  await expect(form.getByText(copy("login.consentRequired"), { exact: true })).toBeVisible();
  await form.getByRole("checkbox", { name: named("login.privacy") }).check();
  await toastAfter(page, form.getByRole("button", { name: copy("login.submit"), exact: true }));
  await form.getByRole("tab", { name: copy("login.passwordTab"), exact: true }).press("Enter");
  await form.getByLabel(copy("login.password"), { exact: true }).fill("demo-password");
  await toastAfter(page, form.getByRole("button", { name: copy("login.passwordSubmit"), exact: true }));
  await expect(form.getByRole("link", { name: copy("login.today"), exact: true })).toHaveAttribute("href", pathTo("S06"));
  expectNoProblems(watch, "normal");
});

test("S01 微信和 Apple 授权不可用时回落到手机验证码，忘记密码入口可直接重设", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { view: "back" }));
  for (const provider of ["wechat", "apple"]) {
    await main(page)
      .getByRole("button", { name: copy(`login.${provider}`), exact: true })
      .press("Enter");
    await expect(main(page).getByText(copy("login.fallback"), { exact: true })).toBeVisible();
    await expect(main(page).getByLabel(copy("login.code"), { exact: true })).toBeVisible();
  }
  await main(page)
    .getByRole("button", { name: copy("login.forgot"), exact: true })
    .press("Enter");
  await expect(main(page).getByRole("heading", { name: copy("login.resetTitle"), exact: true })).toBeVisible();
  await main(page).getByLabel(copy("login.phone"), { exact: true }).fill("13800000000");
  await main(page).getByLabel(copy("login.code"), { exact: true }).fill("123456");
  await main(page).getByLabel(copy("login.newPassword"), { exact: true }).fill("demo-new-password");
  for (const checkbox of await main(page).getByRole("checkbox").all()) await checkbox.check();
  await toastAfter(page, main(page).getByRole("button", { name: copy("login.resetSubmit"), exact: true }), copy("login.resetResult"));
  await main(page)
    .getByRole("button", { name: copy("login.backToLogin"), exact: true })
    .press("Enter");
  await expect(main(page).getByRole("heading", { name: copy("login.title"), exact: true })).toBeVisible();
  expectNoProblems(watch, "normal");
});

test("S01 机构邀请先展示四类数据范围，明确同意后才允许确认", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await main(page)
    .getByRole("button", { name: copy("welcome.invite"), exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: copy("invite.title"), exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(copy("invite.code"), { exact: true }).fill("DEMO-CLASS");
  await dialog.getByRole("button", { name: copy("invite.preview"), exact: true }).press("Enter");
  for (const kind of ["institution", "personal", "sensitive", "inferred"]) {
    await expect(dialog.getByText(copy(`invite.visibility.${kind}`), { exact: true })).toBeVisible();
  }
  await dialog.getByRole("button", { name: copy("invite.confirm"), exact: true }).press("Enter");
  await expect(dialog.getByText(copy("invite.consentRequired"), { exact: true })).toBeVisible();
  await dialog.getByRole("checkbox", { name: copy("invite.consent"), exact: true }).check();
  await toastAfter(page, dialog.getByRole("button", { name: copy("invite.confirm"), exact: true }), copy("invite.soon"));
  expectNoProblems(watch, "normal");
});

test("S01 免费工具与可跳过引导均可点，数据用途默认展开且可去隐私管理", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expect(main(page).getByText(copy("dataUse.learning"), { exact: true })).toBeVisible();
  await expect(main(page).getByRole("link", { name: copy("dataUse.manage"), exact: true })).toHaveAttribute("href", pathTo("S32"));
  for (const tool of ["estimate", "eligibility", "capture", "check"]) {
    await toastAfter(page, main(page).getByRole("button", { name: copy(`tools.${tool}`), exact: true }));
  }
  await main(page)
    .getByRole("button", { name: copy("guide.open"), exact: true })
    .press("Enter");
  const guide = page.getByRole("dialog", { name: copy("guide.title"), exact: true });
  await expect(guide).toBeVisible();
  await guide.getByRole("button", { name: copy("guide.skip"), exact: true }).press("Enter");
  await expect(guide).toBeHidden();
  expectNoProblems(watch, "normal");
});

test("S01 账号异常分清原因，保留导出与设置出路", async ({ page }) => {
  const watch = await watchPage(page);
  for (const issue of ["banned", "devices", "cooling", "replaced", "forced", "password"]) {
    await watch.open(urlOf(entry, { view: "abn", issue }));
    await expect(main(page).getByRole("combobox", { name: copy("account.issuesLabel"), exact: true })).toHaveValue(issue);
    await expect(main(page).getByRole("link", { name: copy("account.export"), exact: true })).toHaveAttribute("href", pathTo("S32"));
    await expect(main(page).getByRole("link", { name: copy("account.settings"), exact: true })).toHaveAttribute("href", pathTo("S33"));
    if (issue === "devices") {
      await toastAfter(
        page,
        main(page).getByRole("button", { name: copy("account.devices.continue"), exact: true }),
        copy("account.devices.choose"),
      );
      await main(page).getByRole("radio").first().check();
      await toastAfter(
        page,
        main(page).getByRole("button", { name: copy("account.devices.continue"), exact: true }),
        copy("account.devices.soon"),
      );
    }
    if (issue === "cooling") {
      await toastAfter(
        page,
        main(page).getByRole("button", { name: copy("account.cooling.undo"), exact: true }),
        copy("account.cooling.undoSoon"),
      );
    }
    if (issue === "banned") {
      await toastAfter(
        page,
        main(page).getByRole("button", { name: copy("account.restricted.appeal"), exact: true }),
        copy("account.restricted.appealSoon"),
      );
    }
    if (["replaced", "forced", "password"].includes(issue))
      await expect(main(page).getByText(copy("account.logout.drafts"), { exact: true })).toBeVisible();
    expectNoProblems(watch, "normal");
  }
});
