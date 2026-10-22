// S31 会员与权益：三档布局、七态、四演示考试与主要购买入口的冒烟测试。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { formatCount, formatDate, formatDateTime } from "../../../packages/shared/src/format/index.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

interface ExamIndex {
  readonly exams: readonly { readonly key: string; readonly exam_id: string }[];
}
interface MembershipFixture {
  readonly exam_name: string;
  readonly time_zone: string;
  readonly view_state: "normal" | "empty" | "restricted" | "insufficient_data";
  readonly current: {
    readonly auto_renew: boolean;
    readonly plan_id: "free" | "member" | "human";
    readonly valid_until: string;
    readonly final_expiry: string;
  };
  readonly usage: readonly { readonly key: string; readonly details: readonly { readonly label: string }[] }[];
  readonly orders: readonly { readonly order_number: string }[];
  readonly payment_failures: readonly { readonly reason: string; readonly order_number: string }[];
  readonly purchase: {
    readonly transfer_credit_text: string;
    readonly pass: { readonly price_text: string; readonly target_day: string; readonly valid_until: string };
    readonly subscription: { readonly price_text: string; readonly period_months: number; readonly next_charge_at: string };
  };
  readonly refund: {
    readonly formula_text: string;
    readonly estimated_text: string;
    readonly progress: readonly { readonly step: string; readonly completed: boolean }[];
  };
  readonly upgrade: { readonly calculation_text: string };
}
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S31.json");
const EXAMS = (readJson("fixtures/exams/index.json") as ExamIndex).exams;
const KJ = readJson("fixtures/pages/S31/junior-accounting.json") as MembershipFixture;
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
const entry = pageById("S31");

function copy(path: string, values: Readonly<Record<string, string | number>> = {}): string {
  let node: unknown = COPY;
  for (const key of path.split(".")) node = typeof node === "object" && node !== null ? (node as Record<string, unknown>)[key] : undefined;
  if (typeof node !== "string") throw new Error(`S31.json 里没有文案 ${path}`);
  return node.replace(PLACEHOLDER, (whole: string, name: string) => (values[name] === undefined ? whole : String(values[name])));
}
function button(page: Page, key: string): Locator {
  return page
    .locator("main#main")
    .getByRole("button", { name: copy(key), exact: true })
    .first();
}
async function pressSoon(page: Page, target: Locator): Promise<void> {
  await target.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
}
async function purchaseConfirmation(page: Page, kind: "pass" | "subscription", renewal: "single" | "auto" = "single"): Promise<Locator> {
  const dialog = page.getByRole("dialog", { name: copy("purchase.confirm_title"), exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(copy("purchase.confirm_note"));
  await expect(dialog).toContainText(copy(kind === "pass" ? "purchase.pass" : "purchase.subscription"));
  await expect(dialog.getByRole("button", { name: copy("cancel"), exact: true })).toBeEnabled();
  if (kind === "pass") {
    await expect(dialog).toContainText(KJ.purchase.pass.price_text);
    await expect(dialog).toContainText(
      copy("purchase.pass_until", {
        target: formatDate(KJ.purchase.pass.target_day, { year: true }),
        until: formatDate(KJ.purchase.pass.valid_until, { year: true }),
      }),
    );
    await expect(dialog).toContainText(copy("purchase.single_note"));
  } else {
    await expect(dialog).toContainText(
      copy("purchase.period", {
        months: formatCount(KJ.purchase.subscription.period_months),
        amount: KJ.purchase.subscription.price_text,
      }),
    );
    await expect(dialog).toContainText(
      renewal === "auto"
        ? copy("purchase.auto_note", {
            date: formatDateTime(KJ.purchase.subscription.next_charge_at, KJ.time_zone, { year: true }),
            amount: KJ.purchase.subscription.price_text,
          })
        : copy("purchase.single_note"),
    );
    await expect(dialog).toContainText(copy("purchase.channel_note"));
  }
  return dialog;
}
async function boxOf(locator: Locator) {
  const box = await locator.first().boundingBox();
  if (box === null) throw new Error("元素没有显示，无法检查布局");
  return box;
}

for (const size of [
  { width: 375, height: 812, split: false },
  { width: 834, height: 900, split: false },
  { width: 1280, height: 900, split: true },
]) {
  test(`S31 ${size.width} 宽：${size.split ? "双栏" : "单栏"}且正文无横向溢出`, async ({ page }, testInfo) => {
    await page.setViewportSize(size);
    const watch = await watchPage(page);
    await watch.open(urlOf(entry));
    await expectOpened(page, entry, undefined);
    await expectLoaded(page, entry);
    const main = await boxOf(page.locator("main#main .ui-cols__main"));
    const aside = await boxOf(page.locator("main#main .ui-cols__aside"));
    if (size.split) expect(aside.x).toBeGreaterThanOrEqual(main.x + main.width - 1);
    else expect(aside.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
    expect(await page.locator("main#main").evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expectNoProblems(watch, "normal");
    await page.screenshot({ path: testInfo.outputPath(`S31-${size.width}.png`), fullPage: false });
    for (const section of ["compare", "purchase"]) {
      const heading = page.getByRole("heading", { name: copy(`${section}.title`), exact: true });
      await heading.scrollIntoViewIfNeeded();
      await heading.evaluate((element) => element.scrollIntoView({ block: "start", inline: "nearest" }));
      await page.screenshot({ path: testInfo.outputPath(`S31-${size.width}-${section}.png`), fullPage: false });
    }
    await page.locator("main#main").evaluate((element) => {
      element.scrollTop = 0;
    });
  });
}

test("S31 页面登记没有多视图，默认视图可正常打开", () => {
  expect(entry.views).toEqual([]);
});

test("S31 七态可强制显示，空、离线与能力受限说明使用原型文案", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.title"));
      await expect(shown).toContainText(copy("state.empty.body"));
      await expect(page.getByRole("heading", { level: 1, name: copy("title"), exact: true })).toBeVisible();
      const compareLink = shown.getByRole("link", { name: copy("state.empty.action"), exact: true });
      await expect(compareLink).toHaveAttribute("href", "#membership-comparison");
      await compareLink.press("Enter");
      await expect(page.getByRole("heading", { name: copy("compare.title"), exact: true })).toBeVisible();
    }
    if (state === "error") await expect(shown).toContainText(copy("state.error.body"));
    if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
    if (state === "restricted" || state === "insufficient_data") {
      await expect(shown).toContainText(copy(`state.${state}.body`));
      await expect(page.getByRole("heading", { name: copy("current.title"), exact: true })).toBeVisible();
    }
    expectNoProblems(watch, state);
  }
});

test("S31 四个演示考试都有对应会员数据，换考试后正确显示当前目标", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    const fixture = readJson(`fixtures/pages/S31/${exam.exam_id}.json`) as MembershipFixture;
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectOpened(page, entry, undefined);
    if (fixture.view_state === "empty") await expectState(page, entry, "empty");
    else await expectLoaded(page, entry);
    await expect(page.locator("main#main")).toContainText(copy("exam", { exam: fixture.exam_name }));
    expectNoProblems(watch, fixture.view_state, `${exam.key}：`);
  }
});

test("S31 购买选择不预选；续费关闭、互转与升级均可查看后操作", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  await expect(main.getByRole("link", { name: copy("current.manage_devices"), exact: true })).toHaveAttribute("href", "/privacy");
  await expect(main.getByRole("link", { name: copy("current.support"), exact: true }).first()).toHaveAttribute("href", "/messages");
  await expect(main).toContainText(copy("current.retained"));
  await expect(main).toContainText(copy("purchase.ios_note"));
  await expect(main).toContainText(copy("purchase.channel_note"));

  if (KJ.current.auto_renew) {
    await button(page, "current.close_renewal").press("Enter");
    const dialog = page.getByRole("dialog", { name: copy("current.close_title"), exact: true });
    await expect(dialog).toBeVisible();
    await pressSoon(page, dialog.getByRole("button", { name: copy("current.close_confirm"), exact: true }));
    await expect(dialog).toBeHidden();
  }
  await button(page, "purchase.pass_buy").press("Enter");
  const pass = await purchaseConfirmation(page, "pass");
  await pass.getByRole("button", { name: copy("cancel"), exact: true }).press("Enter");
  await expect(pass).toBeHidden();
  await button(page, "purchase.pass_buy").press("Enter");
  await purchaseConfirmation(page, "pass");
  await pressSoon(page, pass.getByRole("button", { name: copy("purchase.confirm"), exact: true }));
  await expect(pass).toBeHidden();
  const single = main.getByRole("radio", { name: copy("purchase.single"), exact: true });
  const auto = main.getByRole("radio", { name: copy("purchase.auto"), exact: true });
  await expect(single).not.toBeChecked();
  await expect(auto).not.toBeChecked();
  await expect(button(page, "purchase.submit")).toBeDisabled();
  await single.check();
  await expect(auto).not.toBeChecked();
  await button(page, "purchase.submit").press("Enter");
  const subscription = await purchaseConfirmation(page, "subscription");
  await pressSoon(page, subscription.getByRole("button", { name: copy("purchase.confirm"), exact: true }));
  await expect(subscription).toBeHidden();
  await auto.check();
  await expect(single).not.toBeChecked();
  await expect(main).toContainText(copy("purchase.subscription_body"));
  await button(page, "purchase.submit").press("Enter");
  await purchaseConfirmation(page, "subscription", "auto");
  await pressSoon(page, subscription.getByRole("button", { name: copy("purchase.confirm"), exact: true }));
  await expect(subscription).toBeHidden();

  await button(page, "purchase.transfer").press("Enter");
  const transfer = page.getByRole("dialog", { name: copy("purchase.transfer"), exact: true });
  await expect(transfer).toContainText(copy("purchase.transfer_body", { amount: KJ.purchase.transfer_credit_text }));
  await transfer
    .locator(".ui-dialog__actions")
    .getByRole("button", { name: copy("close"), exact: true })
    .press("Enter");
  await button(page, "upgrade.rules").press("Enter");
  const upgrade = page.getByRole("dialog", { name: copy("upgrade.rules"), exact: true });
  await expect(upgrade).toContainText(KJ.upgrade.calculation_text);
  await upgrade
    .locator(".ui-dialog__actions")
    .getByRole("button", { name: copy("close"), exact: true })
    .press("Enter");
  await pressSoon(page, button(page, "upgrade.action"));
  expectNoProblems(watch, "normal");
});

test("S31 额度明细、加量包、订单发票、退款与兑换入口均可操作", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  for (const item of KJ.usage) {
    const name = copy("usage.detail_title", { name: copy(`usage.${item.key}`) });
    await main.getByRole("button", { name, exact: true }).press("Enter");
    const detail = page.getByRole("dialog", { name, exact: true });
    await expect(detail).toBeVisible();
    for (const row of item.details) await expect(detail).toContainText(row.label);
    await detail
      .locator(".ui-dialog__actions")
      .getByRole("button", { name: copy("close"), exact: true })
      .press("Enter");
  }
  await pressSoon(page, button(page, "addons.buy"));
  await pressSoon(page, button(page, "orders.invoice"));
  await pressSoon(page, button(page, "orders.download"));

  await button(page, "orders.all").press("Enter");
  const all = page.getByRole("dialog", { name: copy("orders.all"), exact: true });
  for (const order of KJ.orders) await expect(all).toContainText(order.order_number);
  await all
    .locator(".ui-dialog__actions")
    .getByRole("button", { name: copy("close"), exact: true })
    .press("Enter");
  await expect(main.getByRole("link", { name: copy("orders.support"), exact: true }).first()).toHaveAttribute(
    "href",
    `/messages?order=${KJ.orders[0]?.order_number}`,
  );

  await button(page, "orders.refund").press("Enter");
  const refund = page.getByRole("dialog", { name: copy("refund.title"), exact: true });
  await expect(refund).toContainText(KJ.refund.formula_text);
  await expect(refund).toContainText(KJ.refund.estimated_text);
  const progress = refund.locator("ol");
  await expect(progress.locator("li")).toHaveCount(KJ.refund.progress.length);
  await expect(progress).not.toContainText(copy("refund.done"));
  for (const item of KJ.refund.progress) {
    await expect(progress.locator("li").filter({ hasText: copy(`refund.${item.step}`) })).toContainText(copy("refund.waiting"));
  }
  await refund.getByRole("button", { name: copy("refund.apply"), exact: true }).press("Enter");
  const confirmNote = copy("refund.confirm_note", { amount: KJ.refund.estimated_text });
  await expect(refund.getByRole("status")).toHaveText(confirmNote);
  await expect(refund.getByRole("button", { name: copy("refund.confirm"), exact: true })).toBeEnabled();
  await refund
    .locator(".ui-dialog__actions")
    .getByRole("button", { name: copy("close"), exact: true })
    .press("Enter");
  await expect(refund).toBeHidden();
  await button(page, "orders.refund").press("Enter");
  await expect(refund.getByRole("status")).toHaveCount(0);
  await refund.getByRole("button", { name: copy("refund.apply"), exact: true }).press("Enter");
  await expect(refund.getByRole("status")).toHaveText(confirmNote);
  await pressSoon(page, refund.getByRole("button", { name: copy("refund.confirm"), exact: true }));
  await expect(refund).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: copy("soon") })).toBeVisible();
  await button(page, "orders.refund_progress").press("Enter");
  await expect(refund).toContainText(copy("refund.status"));
  await expect(refund).toContainText(copy("refund.review"));
  await refund
    .locator(".ui-dialog__actions")
    .getByRole("button", { name: copy("close"), exact: true })
    .press("Enter");

  await button(page, "redemption.action").press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("redemption.empty") })).toBeVisible();
  await main.getByRole("textbox", { name: copy("redemption.label"), exact: true }).fill("DEMO-S31-2026");
  await pressSoon(page, button(page, "redemption.action"));
  expectNoProblems(watch, "normal");
});

test("S31 支付失败按原因给出重试或人工客服，宽限期可更新支付方式", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  const reason = main.getByRole("combobox", { name: copy("payment.reason"), exact: true });
  for (const failure of KJ.payment_failures) {
    await reason.selectOption(failure.reason);
    await expect(main.getByText(copy(`payment.${failure.reason}`), { exact: true }).last()).toBeVisible();
    if (failure.reason === "charged_not_activated") {
      await expect(main.getByRole("button", { name: copy("payment.retry"), exact: true })).toHaveCount(0);
      await expect(main.getByRole("link", { name: copy("payment.support"), exact: true })).toHaveAttribute(
        "href",
        `/messages?order=${failure.order_number}`,
      );
    } else await pressSoon(page, button(page, "payment.retry"));
  }
  expectNoProblems(watch, "normal");

  await watch.open(urlOf(entry, { exam: "js" }));
  await expectLoaded(page, entry);
  await pressSoon(page, button(page, "current.payment_method"));
  expectNoProblems(watch, "normal");
});

test("S31 通行证与免费权益不显示自动续期，免费权益长期有效且自然空订单有出路", async ({ page }) => {
  const watch = await watchPage(page);
  for (const key of ["en", "ds"]) {
    const exam = EXAMS.find((item) => item.key === key);
    if (exam === undefined) throw new Error(`找不到演示考试 ${key}`);
    const fixture = readJson(`fixtures/pages/S31/${exam.exam_id}.json`) as MembershipFixture;
    await watch.open(urlOf(entry, { exam: key }));
    if (fixture.view_state === "empty") await expectState(page, entry, "empty");
    else await expectLoaded(page, entry);
    const main = page.locator("main#main");
    const current = main.locator(".ui-card").filter({ has: page.getByRole("heading", { name: copy("current.title"), exact: true }) });
    await expect(current).toContainText(copy("current.manual"));
    await expect(main).not.toContainText(copy("current.renewing"));
    await expect(main.getByRole("button", { name: copy("current.close_renewal"), exact: true })).toHaveCount(0);
    if (fixture.current.plan_id === "free") {
      for (const key of ["current.valid", "current.final"]) {
        await expect(
          current
            .locator(".ui-kv__row")
            .filter({ hasText: copy(key) })
            .locator("dd"),
        ).toHaveText(copy("current.lifetime"));
      }
      await expect(current).not.toContainText(formatDate(fixture.current.valid_until, { year: true }));
      await expect(current).not.toContainText(formatDate(fixture.current.final_expiry, { year: true }));
    }
    if (fixture.orders.length === 0) {
      const empty = main.locator(".ui-state--empty").first();
      await expect(empty).toContainText(copy("state.empty.title"));
      await expect(empty).toContainText(copy("state.empty.body"));
      await expect(empty.getByRole("link", { name: copy("state.empty.action"), exact: true })).toHaveAttribute(
        "href",
        "#membership-comparison",
      );
      await expect(button(page, "orders.refund")).toBeDisabled();
      await button(page, "orders.all").press("Enter");
      const all = page.getByRole("dialog", { name: copy("orders.all"), exact: true });
      await expect(all).toContainText(copy("orders.empty"));
      await all
        .locator(".ui-dialog__actions")
        .getByRole("button", { name: copy("close"), exact: true })
        .press("Enter");
    }
    expectNoProblems(watch, fixture.view_state, `${key}：`);
  }
});
