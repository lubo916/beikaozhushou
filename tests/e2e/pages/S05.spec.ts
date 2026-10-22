// S05 smoke: views, states, three widths, map, scope proposals and scheme preview.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { pathTo } from "../../../apps/learner/src/routes.ts";
import { formatCount, formatDuration } from "../../../packages/shared/src/format/index.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";
interface Fixture {
  report: {
    grid: readonly { knowledge_point_id: string; name: string }[];
    chapters: readonly { name: string }[];
    schemes: readonly {
      id: "steady" | "standard" | "sprint";
      first_week_minutes: number;
      first_week_tasks: number;
      day_plan: readonly { day: string }[];
    }[];
  };
}
const read = (path: string): unknown => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as unknown;
const COPY = read("apps/learner/src/i18n/zh-CN/S05.json");
const UI = read("packages/ui/src/copy.zh-CN.json") as { action: { confirm: string; decline: string } };
const entry = pageById("S05");
const fixture = read("fixtures/pages/S05/junior-accounting.json") as Fixture;
const BLOCKED = read("fixtures/pages/S05/ds-final-custom.json") as { report: { repairs: readonly unknown[] } };
function copy(path: string, values: Readonly<Record<string, string>> = {}): string {
  let value: unknown = COPY;
  for (const key of path.split("."))
    value = typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  if (typeof value !== "string") throw new Error("Missing S05 copy: " + path);
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole: string, key: string) => values[key] ?? whole);
}
for (const width of [375, 834, 1280])
  for (const view of ["normal", "quick"]) {
    test(`S05 ${width}: ${view} layout`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const watch = await watchPage(page);
      await watch.open(urlOf(entry, { view }));
      await expectOpened(
        page,
        entry,
        entry.views.find((item) => item.key === view),
      );
      await expectLoaded(page, entry);
      await expect(page.getByRole("heading", { level: 1, name: copy("header.title"), exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: copy("plan.generate"), exact: true })).toBeVisible();
      if (view === "quick") await expect(page.locator("main#main .ui-state--insufficient_data")).toContainText(copy("state.quick.body"));
      expect(await page.locator("main#main").evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      const main = await page.locator("main#main .ui-cols__main").boundingBox();
      const aside = await page.locator("main#main .ui-cols__aside").boundingBox();
      expect(main).not.toBeNull();
      expect(aside).not.toBeNull();
      if (main !== null && aside !== null) {
        if (width === 1280) expect(aside.x).toBeGreaterThanOrEqual(main.x + main.width - 1);
        else expect(aside.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
      }
      if (width === 375)
        await expect(page.getByRole("link", { name: copy("hero.jump"), exact: true })).toHaveAttribute("href", "#s05-schemes");
      mkdirSync(join(ROOT, ".test-results/S05"), { recursive: true });
      await page.screenshot({ path: join(ROOT, `.test-results/S05/${view}-${width}.png`), fullPage: true });
      expectNoProblems(watch, "normal");
    });
  }
test("S05 seven states and specified actions", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state }));
    await expectState(page, entry, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.body"));
      await expect(shown.getByRole("link", { name: copy("state.empty.action") })).toHaveAttribute("href", pathTo("S04"));
    }
    if (state === "error") {
      await expect(shown).toContainText(copy("state.error.body"));
      await shown.getByRole("button").last().press("Enter");
      await expect(page.getByRole("status").filter({ hasText: copy("soon.report") })).toBeVisible();
    }
    if (state === "offline") await expect(shown).toContainText(copy("state.offline.body"));
    if (state === "restricted") {
      await expect(shown).toContainText(copy("state.restricted.body"));
      await expect(page.getByRole("button", { name: copy("plan.generate"), exact: true })).toBeVisible();
    }
    if (state === "insufficient_data") {
      await expect(shown).toContainText(copy("state.quick.body"));
      await expect(shown.getByRole("link", { name: copy("state.quick.action") })).toHaveAttribute("href", pathTo("S04"));
    }
    expectNoProblems(watch, state);
  }
});
test("S05 four demos; blocked map locks predictions only", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of ["kj", "js", "en", "ds"]) {
    await watch.open(urlOf(entry, { exam }));
    await expect(page.getByRole("tab", { name: copy("map.grid"), exact: true })).toBeVisible();
    if (exam === "ds") {
      await expect(page.locator("main#main .ui-state--locked")).toContainText(copy("locked.title"));
      await expect(page.getByText(copy("hero.forecast"), { exact: true })).toHaveCount(0);
      // 决定 U05-Q1＝A：体检不通过只锁预测类数字；方案与生成计划照常，方案卡不显示预期区间与区间上移。
      await expect(page.getByText(copy("schemes.expected"))).toHaveCount(0);
      await expect(page.getByText(copy("gap.locked_hint"))).toBeVisible();
      await expect(page.locator("main#main #s05-repairs li")).toHaveCount(BLOCKED.report.repairs.length);
      await expect(page.getByRole("heading", { name: copy("schemes.title"), exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: copy("plan.generate"), exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: copy("locked.fix"), exact: true }).first()).toHaveAttribute("href", pathTo("S09"));
    } else await expectLoaded(page, entry);
    expectNoProblems(watch, "normal");
  }
});
test("S05 map tabs, routes and scope proposal buttons", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  const main = page.locator("main#main");
  await main.getByRole("tab", { name: copy("map.chapters"), exact: true }).press("Enter");
  await expect(main.getByRole("tabpanel")).toContainText(fixture.report.chapters[0]?.name ?? "");
  await main.getByRole("tab", { name: copy("map.grid"), exact: true }).press("Enter");
  await expect(main.getByRole("group", { name: copy("map.title"), exact: true }).getByRole("button")).toHaveCount(
    fixture.report.grid.length,
  );
  for (const [key, target] of [
    ["map.open", "S09"],
    ["time.adjust_time", "S03"],
    ["time.adjust_goal", "S02"],
  ] as const)
    await expect(main.getByRole("link", { name: copy(key), exact: true })).toHaveAttribute("href", pathTo(target));
  await main.getByRole("button", { name: UI.action.confirm, exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("soon.proposal") })).toBeVisible();
  await main.getByRole("button", { name: UI.action.decline, exact: true }).press("Enter");
  await expect(page.getByRole("status").filter({ hasText: copy("soon.decline") })).toBeVisible();
  const first = fixture.report.grid[0];
  if (first === undefined) throw new Error("No S05 cells");
  await main
    .getByRole("group", { name: copy("map.title"), exact: true })
    .getByRole("button")
    .first()
    .press("Enter");
  await expect(page).toHaveURL(new RegExp(pathTo("S10", { kpId: first.knowledge_point_id }) + "$"));
  expectNoProblems(watch, "normal");
});
test("S05 all schemes preview their first week and request login to save", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry));
  await expectLoaded(page, entry);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const scheme of fixture.report.schemes) {
    await page.getByRole("radio", { name: copy(`schemes.name.${scheme.id}`), exact: true }).check();
    await page.getByRole("button", { name: copy("plan.generate"), exact: true }).press("Enter");
    const dialog = page.getByRole("dialog", { name: copy("plan.title"), exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(copy("plan.chosen", { name: copy(`schemes.name.${scheme.id}`) }));
    await expect(dialog).toContainText(
      copy("plan.week", { duration: formatDuration(scheme.first_week_minutes), amount: formatCount(scheme.first_week_tasks) }),
    );
    await expect(dialog.locator(".ui-ai")).toContainText(copy("plan.logic"));
    await expect(dialog.getByRole("link", { name: copy("plan.login"), exact: true })).toHaveAttribute("href", pathTo("S01"));
    await expect(dialog.locator(".ui-table tbody tr")).toHaveCount(scheme.day_plan.length);
    await dialog.getByRole("button", { name: copy("plan.cancel"), exact: true }).press("Enter");
    await expect(dialog).toBeHidden();
  }
  expectNoProblems(watch, "normal");
});

test("S05 offline reload keeps only the same exam and view report", async ({ page }) => {
  const watch = await watchPage(page);
  await watch.open(urlOf(entry, { exam: "kj", view: "normal" }));
  await expectLoaded(page, entry);
  await watch.open(urlOf(entry, { exam: "kj", view: "normal", state: "offline" }));
  await page.reload();
  await expectState(page, entry, "offline");
  await expect(page.getByText(copy("hero.forecast"), { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: copy("plan.generate"), exact: true })).toBeDisabled();
  expectNoProblems(watch, "offline");
  for (const query of [
    { exam: "js", view: "normal" },
    { exam: "kj", view: "quick" },
  ]) {
    await watch.open(urlOf(entry, { ...query, state: "offline" }));
    await expectState(page, entry, "offline");
    await expect(page.getByText(copy("hero.forecast"), { exact: true })).toHaveCount(0);
    await expect(page.locator("main#main .ui-state--offline")).toContainText(copy("state.offline.uncached"));
    expectNoProblems(watch, "offline");
  }
});
