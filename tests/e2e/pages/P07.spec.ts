// P07 内容生产流水线冒烟（W04）：三档宽度布局、每个 ?state=、四个演示考试、主要按钮（提示“即将上线”或跳路由表里的页面）。
// 文案从 i18n 文件读、示例数据从 fixture 读，不在测试里抄一份。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URLS, ROOT } from "../support/env.ts";

interface P07Copy {
  readonly soon: string;
  readonly scope: string;
  readonly queue: { readonly parse: string; readonly review: string };
  readonly review: {
    readonly title: string;
    readonly approve: string;
    readonly open: string;
    readonly kinds: Readonly<Record<string, string>>;
  };
  readonly materials: { readonly title: string };
  readonly productions: { readonly title: string };
  readonly state: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
interface P07File {
  readonly normal: {
    readonly exam_name: string;
    readonly review: { readonly items: readonly { readonly kind: string; readonly title: string }[] };
  };
}

const read = <T>(path: string): T => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as T;
const copy = read<P07Copy>("apps/admin/src/i18n/zh-CN/P07.json");
const EXAMS = { kj: "junior-accounting", js: "teacher-qualification", en: "cet-6", ds: "ds-final-custom" } as const;
const pipeline = (id: string) => read<P07File>(`fixtures/pages/P07/${id}.json`).normal;
const fill = (template: string, values: Readonly<Record<string, string | number>>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_whole, key: string) => String(values[key] ?? ""));
const open = (page: Page, query = "") => page.goto(`${APP_URLS.admin}/pipeline${query}`);
const main = (page: Page) => page.locator("main#main");
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** 筛选片的名称后面还跟着接口给的条数，按开头匹配。 */
const chip = (page: Page, label: string) => main(page).getByRole("button", { name: new RegExp(`^${escape(label)}`) });
const STATE_TEXT: Readonly<Record<string, string | undefined>> = {
  loading: undefined,
  empty: copy.state["empty"]?.["body"],
  error: copy.state["error"]?.["body"],
  offline: copy.state["offline"]?.["title"],
  restricted: copy.state["restricted"]?.["body"],
  insufficient_data: copy.state["insufficient_data"]?.["body"],
};

test.describe("P07 内容生产流水线", () => {
  for (const width of [375, 834, 1280]) {
    test(`宽 ${width}：待办数、审核台、教材处理、解析与卡片生产都在，正文不横向溢出；宽屏解析与卡片生产在右栏`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      const review = main(page).getByRole("heading", { name: copy.review.title, exact: true });
      const productions = main(page).getByRole("heading", { name: copy.productions.title, exact: true });
      await expect(main(page).getByText(copy.queue.parse, { exact: true })).toBeVisible();
      await expect(main(page).getByText(copy.queue.review, { exact: true })).toBeVisible();
      await expect(review).toBeVisible();
      await expect(main(page).getByRole("heading", { name: copy.materials.title, exact: true })).toBeVisible();
      await expect(productions).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const left = await review.boundingBox();
      const right = await productions.boundingBox();
      if (left === null || right === null) throw new Error("找不到审核台或解析与卡片生产");
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
    test(`演示考试 ?exam=${key}：考试范围与审核台首条来自假数据`, async ({ page }) => {
      await open(page, `?exam=${key}`);
      const data = pipeline(id);
      await expect(main(page)).toContainText(fill(copy.scope, { exam: data.exam_name }));
      await expect(main(page).getByRole("article", { name: data.review.items[0]?.title ?? "" })).toBeVisible();
    });
  }

  test("主要按钮：通过提示即将上线；切条目类型；换一条审", async ({ page }) => {
    const items = pipeline(EXAMS.kj).review.items;
    const card = items.find((item) => item.kind === "card")?.title ?? "";
    await open(page);
    await main(page).getByRole("button", { name: copy.review.approve, exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: copy.soon })).toBeVisible();
    await chip(page, copy.review.kinds["card"] ?? "").click();
    await expect(main(page).getByRole("article", { name: card })).toBeVisible();
    await chip(page, copy.review.kinds["all"] ?? "").click();
    await expect(main(page).getByRole("article", { name: items[0]?.title ?? "" })).toBeVisible();
    await main(page).getByRole("button", { name: copy.review.open, exact: true }).first().click();
    await expect(main(page).getByRole("article", { name: items[0]?.title ?? "" })).toHaveCount(0);
  });

  test("空态与受限态的按钮可用", async ({ page }) => {
    await open(page, "?state=empty");
    await main(page)
      .getByRole("button", { name: copy.state["empty"]?.["action"] ?? "" })
      .click();
    await expect(main(page).locator(".ui-state--empty")).toBeVisible();
    await open(page, "?state=restricted");
    await main(page)
      .getByRole("link", { name: copy.state["restricted"]?.["action"] ?? "" })
      .click();
    await expect(page).toHaveURL(/\/system$/);
  });
});
