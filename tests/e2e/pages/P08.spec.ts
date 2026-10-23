// P08 题库审核与质量冒烟（W04）：三档宽度布局、每个 ?state=、四个演示考试、主要按钮（提示“即将上线”或跳路由表里的页面）。
// 文案从 i18n 文件读、示例数据从 fixture 读，不在测试里抄一份。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URLS, ROOT } from "../support/env.ts";

interface P08Copy {
  readonly soon: string;
  readonly scope: string;
  readonly queue: { readonly title: string; readonly check: string; readonly origins: Readonly<Record<string, string>> };
  readonly checks: { readonly title: string };
  readonly variants: { readonly title: string };
  readonly reports: { readonly title: string; readonly reply: string };
  readonly state: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
interface P08File {
  readonly normal: {
    readonly exam_name: string;
    readonly tasks: readonly { readonly origin: string; readonly question_ref: string }[];
  };
}

const read = <T>(path: string): T => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as T;
const copy = read<P08Copy>("apps/admin/src/i18n/zh-CN/P08.json");
const EXAMS = { kj: "junior-accounting", js: "teacher-qualification", en: "cet-6", ds: "ds-final-custom" } as const;
const review = (id: string) => read<P08File>(`fixtures/pages/P08/${id}.json`).normal;
const fill = (template: string, values: Readonly<Record<string, string | number>>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_whole, key: string) => String(values[key] ?? ""));
const open = (page: Page, query = "") => page.goto(`${APP_URLS.admin}/question-review${query}`);
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

test.describe("P08 题库审核与质量", () => {
  for (const width of [375, 834, 1280]) {
    test(`宽 ${width}：审核队列、七道质检、变式题池、报错闭环都在，正文不横向溢出；宽屏报错闭环在右栏`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      const queue = main(page).getByRole("heading", { name: copy.queue.title, exact: true });
      const reports = main(page).getByRole("heading", { name: copy.reports.title, exact: true });
      await expect(queue).toBeVisible();
      await expect(main(page).getByRole("heading", { name: copy.checks.title, exact: true })).toBeVisible();
      await expect(main(page).getByRole("heading", { name: copy.variants.title, exact: true })).toBeVisible();
      await expect(reports).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const left = await queue.boundingBox();
      const right = await reports.boundingBox();
      if (left === null || right === null) throw new Error("找不到审核队列或报错闭环");
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
    test(`演示考试 ?exam=${key}：考试范围与审核队列首题来自假数据`, async ({ page }) => {
      await open(page, `?exam=${key}`);
      const data = review(id);
      await expect(main(page)).toContainText(fill(copy.scope, { exam: data.exam_name }));
      await expect(main(page)).toContainText(data.tasks[0]?.question_ref ?? "");
    });
  }

  test("主要按钮：去核对、回复结论提示即将上线；切来源只看被修改的题", async ({ page }) => {
    const tasks = review(EXAMS.kj).tasks;
    const fresh = tasks.find((task) => task.origin === "new")?.question_ref ?? "";
    const changed = tasks.find((task) => task.origin === "modified")?.question_ref ?? "";
    await open(page);
    await main(page).getByRole("button", { name: copy.queue.check, exact: true }).first().click();
    await expect(page.getByRole("status").filter({ hasText: copy.soon })).toBeVisible();
    await main(page).getByRole("button", { name: copy.reports.reply, exact: true }).first().click();
    await expect(page.getByRole("status").filter({ hasText: copy.soon })).toBeVisible();
    await chip(page, copy.queue.origins["modified"] ?? "").click();
    await expect(main(page).getByRole("table").first()).toContainText(changed);
    await expect(main(page).getByRole("table").first()).not.toContainText(fresh);
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
