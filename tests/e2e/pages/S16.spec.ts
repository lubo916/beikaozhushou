// S16 简版：三档宽度、主视图、七态、四考试与八项 P0 的可用入口。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { pathTo } from "../../../apps/learner/src/routes.ts";
import { formatPercent } from "../../../packages/shared/src/format/index.ts";
import { pageById, urlOf } from "../support/catalog.ts";
import { ABNORMAL_STATES, expectLoaded, expectNoProblems, expectOpened, expectState, watchPage } from "../support/checks.ts";
import { ROOT } from "../support/env.ts";

interface PageFixture {
  readonly default_level: string;
  readonly default_source: string;
  readonly default_segment: string;
  readonly order_min_samples: number;
  readonly items: readonly {
    readonly title: string;
    readonly reference: string;
    readonly outline: readonly string[];
    readonly segments: readonly { readonly id: string; readonly label: string; readonly reference: string }[];
    readonly variants: readonly { readonly source: string; readonly level: string; readonly segment_id: string; readonly prompt: string }[];
  }[];
  readonly match_profiles: readonly {
    readonly id: string;
    readonly bands: readonly { readonly grade: string; readonly minimum_match: number }[];
  }[];
}
interface IndexJson {
  readonly exams: readonly { readonly key: string; readonly exam_id: string }[];
}
const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as unknown;
const COPY = readJson("apps/learner/src/i18n/zh-CN/S16.json");
const EXAMS = (readJson("fixtures/exams/index.json") as IndexJson).exams;
const KJ = readJson("fixtures/pages/S16/junior-accounting.json") as PageFixture;
const entry = pageById("S16");
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

function copy(path: string, values: Readonly<Record<string, string | number>> = {}): string {
  let value: unknown = COPY;
  for (const key of path.split("."))
    value = typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
  if (typeof value !== "string") throw new Error(`S16 没有文案 ${path}`);
  return value.replace(PLACEHOLDER, (whole: string, key: string) => (values[key] === undefined ? whole : String(values[key])));
}
function workspace(page: Page): Locator {
  return page.getByTestId("s16-workspace");
}
async function open(page: Page): Promise<void> {
  await page.goto(urlOf(entry, { exam: "kj" }));
  await expect(workspace(page)).toBeVisible();
}
async function pressToast(page: Page, target: Locator, text: string): Promise<void> {
  await target.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: text }).first()).toBeVisible();
}
async function choose(page: Page, group: string, label: string): Promise<void> {
  await page.getByRole("radiogroup", { name: group, exact: true }).getByRole("radio", { name: label, exact: true }).press("Enter");
}

for (const size of [
  { width: 375, height: 812, split: false },
  { width: 834, height: 900, split: false },
  { width: 1280, height: 900, split: true },
]) {
  test(`S16 ${size.width} 宽：布局不横向溢出，主视图可打开`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const watch = await watchPage(page);
    await watch.open(urlOf(entry, { view: "main", exam: "kj" }));
    await expectOpened(page, entry, undefined);
    await expectLoaded(page, entry);
    const main = await page.locator("main#main .ui-cols__main").first().boundingBox();
    const aside = await page.locator("main#main .ui-cols__aside").first().boundingBox();
    expect(main).not.toBeNull();
    expect(aside).not.toBeNull();
    if (main !== null && aside !== null) {
      if (size.split) expect(aside.x).toBeGreaterThanOrEqual(main.x + main.width - 1);
      else expect(aside.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
    }
    expect(await page.locator("main#main").evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expectNoProblems(watch, "normal");
  });
}

test("S16 七态的文案、局部限制与出路正确", async ({ page }) => {
  const watch = await watchPage(page);
  for (const state of ABNORMAL_STATES) {
    await watch.open(urlOf(entry, { state, exam: "kj" }));
    await expectState(page, entry, state);
    const shown = page.locator(`main#main .ui-state--${state}`).first();
    if (state === "empty") {
      await expect(shown).toContainText(copy("state.empty.body"));
      await expect(shown.getByRole("link", { name: copy("state.empty.action") })).toHaveAttribute("href", pathTo("S12"));
      await expect(page.getByRole("heading", { level: 1, name: copy("title"), exact: true })).toBeVisible();
    }
    if (state === "offline") {
      await expect(shown).toContainText(copy("state.offline.body"));
      await expect(shown).toContainText(copy("state.offline.uncached"));
    }
    if (state === "error") await expect(shown).toContainText(copy("state.error.body"));
    if (state === "restricted") {
      await expect(shown).toContainText(copy("state.restricted.body"));
      await expect(workspace(page).getByLabel(copy("draft"), { exact: true })).toBeEditable();
      await page.getByRole("tab", { name: copy("method.oral"), exact: true }).press("Enter");
      await expect(workspace(page).getByRole("button", { name: copy("oral.start"), exact: true })).toBeDisabled();
      await expect(shown.getByRole("link", { name: copy("state.restricted.action") })).toHaveAttribute("href", pathTo("S31"));
    }
    if (state === "insufficient_data") {
      await expect(shown).toContainText(copy("state.insufficient.body", { value: KJ.order_min_samples }));
      await expect(workspace(page)).toBeVisible();
      await expect(
        page
          .getByTestId("s16-result")
          .locator("dt")
          .filter({ hasText: new RegExp(`^${copy("last.order")}$`) }),
      ).toHaveCount(0);
    }
    expectNoProblems(watch, state);
  }
});

test("S16 四个演示考试都展示自己的训练材料", async ({ page }) => {
  const watch = await watchPage(page);
  for (const exam of EXAMS) {
    const data = readJson(`fixtures/pages/S16/${exam.exam_id}.json`) as PageFixture;
    await watch.open(urlOf(entry, { exam: exam.key }));
    await expectLoaded(page, entry);
    await expect(workspace(page)).toContainText(data.items[0]?.title ?? "");
    expectNoProblems(watch, "normal", `${exam.key}：`);
  }
});

test("S16 两种挖空来源与三级切换，切换后不沿用旧草稿或原文揭晓状态", async ({ page }) => {
  await open(page);
  const item = KJ.items[0];
  if (item === undefined) throw new Error("S16 缺少主示例");
  const draft = () => workspace(page).getByLabel(copy("draft"), { exact: true });
  for (const source of ["user", "tutor"]) {
    await choose(page, copy("sourceLabel"), copy(`source.${source}`));
    for (const level of ["keywords", "initials", "full"]) {
      await choose(page, copy("levelLabel"), copy(`level.${level}`));
      const variant = item.variants.find((value) => value.source === source && value.level === level && value.segment_id === "all");
      if (variant === undefined) throw new Error(`缺少 ${source}/${level} 版本`);
      if (variant.prompt.trim() !== "") await expect(workspace(page)).toContainText(variant.prompt);
      else await expect(workspace(page)).toContainText(copy("recall"));
      await expect(draft()).toHaveValue("");
      await expect(workspace(page).getByRole("heading", { name: copy("reference"), exact: true })).toHaveCount(0);
      await draft().fill("本次回忆草稿");
      await workspace(page)
        .getByRole("button", { name: copy("reveal"), exact: true })
        .press("Enter");
      await expect(workspace(page)).toContainText(item.reference);
    }
  }
});

test("S16 要点模式先回忆后看骨架，分段可以逐段再合并", async ({ page }) => {
  await open(page);
  const item = KJ.items[0];
  if (item === undefined) throw new Error("S16 缺少主示例");
  await page.getByRole("tab", { name: copy("method.points"), exact: true }).press("Enter");
  await expect(workspace(page)).toContainText(copy("pointsHint"));
  for (const outline of item.outline) await expect(workspace(page).getByText(outline, { exact: true })).toHaveCount(0);
  await workspace(page)
    .getByRole("button", { name: copy("showOutline"), exact: true })
    .press("Enter");
  for (const outline of item.outline) await expect(workspace(page).getByText(outline, { exact: true })).toBeVisible();
  await workspace(page).getByLabel(copy("draft"), { exact: true }).fill("要点草稿");
  await page.getByRole("tab", { name: copy("method.segments"), exact: true }).press("Enter");
  for (const segment of item.segments) {
    await choose(page, copy("segmentLabel"), segment.label);
    await expect(workspace(page).getByLabel(copy("draft"), { exact: true })).toHaveValue("");
    await expect(workspace(page).getByRole("heading", { name: copy("reference"), exact: true })).toHaveCount(0);
    await workspace(page)
      .getByRole("button", { name: copy("reveal"), exact: true })
      .press("Enter");
    await expect(workspace(page)).toContainText(segment.reference);
    await workspace(page).getByLabel(copy("draft"), { exact: true }).fill("分段草稿");
  }
});

test("S16 主要动作说明即将上线，检查不会改写上次结果或请求录音", async ({ page }) => {
  await page.addInitScript(() => {
    const target = window as unknown as { s16MicrophoneRequests: number };
    target.s16MicrophoneRequests = 0;
    if (navigator.mediaDevices !== undefined) {
      navigator.mediaDevices.getUserMedia = async () => {
        target.s16MicrophoneRequests += 1;
        throw new Error("S16 简版不应请求麦克风");
      };
    }
  });
  await open(page);
  const main = page.locator("main#main");
  const before = await page.getByTestId("s16-result").innerText();
  await pressToast(page, main.getByRole("button", { name: copy("morning"), exact: true }), copy("soon.morning"));
  await workspace(page).getByLabel(copy("draft"), { exact: true }).fill("回忆内容");
  await pressToast(page, workspace(page).getByRole("button", { name: copy("check"), exact: true }), copy("soon.check"));
  await expect(page.getByTestId("s16-result")).toHaveText(before);
  await pressToast(page, main.getByRole("button", { name: copy("queue"), exact: true }), copy("soon.queue"));
  await choose(page, copy("compare.label"), copy("compare.profile.strict"));
  const strict = KJ.match_profiles.find((profile) => profile.id === "strict");
  if (strict === undefined) throw new Error("S16 缺少严格阈值示例");
  for (const band of strict.bands.filter((value) => value.grade !== "wrong")) {
    await expect(main).toContainText(copy("compare.band", { value: formatPercent(band.minimum_match) }));
  }
  await pressToast(page, main.getByRole("button", { name: copy("compare.save"), exact: true }), copy("soon.profile"));
  await page.getByRole("tab", { name: copy("method.oral"), exact: true }).press("Enter");
  await pressToast(page, workspace(page).getByRole("button", { name: copy("oral.start"), exact: true }), copy("soon.oral"));
  await workspace(page).getByLabel(copy("oral.transcript"), { exact: true }).fill("本次口述转写草稿");
  await pressToast(page, workspace(page).getByRole("button", { name: copy("check"), exact: true }), copy("soon.check"));
  await expect(main.getByRole("link", { name: copy("privacy.link"), exact: true })).toHaveAttribute("href", pathTo("S32"));
  expect(await page.evaluate(() => (window as unknown as { s16MicrophoneRequests: number }).s16MicrophoneRequests)).toBe(0);
  await expect(page.getByTestId("s16-result")).toHaveText(before);
});
