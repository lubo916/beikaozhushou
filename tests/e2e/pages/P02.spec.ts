// P02 数据中台冒烟（W01）：三档宽度布局、每个 ?state=、四个演示考试、主要按钮（分类、搜索、清除筛选、版本记录）。
// 文案从 i18n 文件读、示例内容从 fixture 读，不在测试里抄一份。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URLS, ROOT } from "../support/env.ts";

interface P02Copy {
  readonly scope: string;
  readonly categories: Readonly<Record<string, string>>;
  readonly filters: { readonly search: string };
  readonly dictionary: { readonly title: string };
  readonly quality: { readonly title: string };
  readonly state: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
interface P02Item {
  readonly metric_id: string;
  readonly name: string;
  readonly definition: string;
  readonly versions: readonly { readonly change_note: string }[];
}
interface P02File {
  readonly dictionary: { readonly exam_name: string; readonly items: readonly P02Item[] };
}

const read = <T>(path: string): T => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as T;
const copy = read<P02Copy>("apps/admin/src/i18n/zh-CN/P02.json");
const EXAMS = { kj: "junior-accounting", js: "teacher-qualification", en: "cet-6", ds: "ds-final-custom" } as const;
const dictionary = (id: string) => read<P02File>(`fixtures/pages/P02/${id}.json`).dictionary;
const item = (id: string, metric: string) => {
  const found = dictionary(id).items.find((entry) => entry.metric_id === metric);
  if (found === undefined) throw new Error(`fixture 缺少指标 ${metric}`);
  return found;
};
const open = (page: Page, query = "") => page.goto(`${APP_URLS.admin}/data-hub${query}`);
const main = (page: Page) => page.locator("main#main");
const STATE_TEXT: Readonly<Record<string, string | undefined>> = {
  loading: undefined,
  empty: copy.state["empty"]?.["body"],
  error: copy.state["error"]?.["body"],
  offline: copy.state["offline"]?.["title"],
  restricted: copy.state["restricted"]?.["body"],
  insufficient_data: copy.state["insufficient_data"]?.["body"],
};

test.describe("P02 数据中台", () => {
  for (const width of [375, 834, 1280]) {
    test(`宽 ${width}：指标字典与数据质量卡都在，正文不横向溢出；宽屏数据质量在右栏`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      const table = main(page).getByRole("heading", { name: copy.dictionary.title, exact: true });
      const quality = main(page).getByRole("heading", { name: copy.quality.title, exact: true });
      await expect(table).toBeVisible();
      await expect(quality).toBeVisible();
      await expect(main(page).getByText(item(EXAMS.kj, "weekly_effective_learners").name).first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const left = await table.boundingBox();
      const right = await quality.boundingBox();
      if (left === null || right === null) throw new Error("找不到字典或数据质量卡片");
      if (width === 1280) expect(right.x).toBeGreaterThan(left.x + width / 4);
      else expect(right.y).toBeGreaterThan(left.y);
    });
  }

  for (const [state, text] of Object.entries(STATE_TEXT)) {
    test(`?state=${state} 显示公共状态组件与 bk spec 文案`, async ({ page }) => {
      await open(page, `?state=${state}`);
      await expect(main(page).locator(`.ui-state--${state}`).first()).toBeVisible();
      if (text !== undefined) await expect(main(page)).toContainText(text);
    });
  }

  for (const [key, id] of Object.entries(EXAMS)) {
    test(`演示考试 ?exam=${key}：考试范围与“已过线”口径随考试变化`, async ({ page }) => {
      await open(page, `?exam=${key}`);
      await expect(main(page)).toContainText(copy.scope.replace("{{exam}}", dictionary(id).exam_name));
      await expect(main(page)).toContainText(item(id, "passed_line").definition);
    });
  }

  test("主要按钮：按分类筛选、搜索、搜不到时清除筛选、展开版本记录", async ({ page }) => {
    await open(page);
    const first = item(EXAMS.kj, "weekly_effective_learners");
    await main(page).locator("summary").first().click();
    await expect(
      main(page)
        .getByText(first.versions[0]?.change_note ?? "", { exact: false })
        .first(),
    ).toBeVisible();
    await main(page)
      .getByRole("button", { name: new RegExp(`^${copy.categories["cost"] ?? ""}`) })
      .click();
    await expect(main(page).getByText(item(EXAMS.kj, "tutor_cost_per_active").name, { exact: true })).toBeVisible();
    await expect(main(page).getByText(first.name, { exact: true })).toHaveCount(0);
    const search = main(page).getByRole("searchbox", { name: copy.filters.search });
    await search.fill("没有这个指标");
    await expect(main(page).locator(".ui-state--empty")).toBeVisible();
    await main(page)
      .getByRole("button", { name: copy.state["empty"]?.["action"] ?? "" })
      .click();
    await expect(main(page).getByText(first.name, { exact: true })).toBeVisible();
    await search.fill(item(EXAMS.kj, "retention_day_n").name);
    await expect(main(page).getByText(item(EXAMS.kj, "retention_day_n").name, { exact: true })).toBeVisible();
  });
});
