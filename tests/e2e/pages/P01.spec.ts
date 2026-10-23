// P01 运营驾驶舱冒烟（W01）：三档宽度布局、每个 ?state=、四个演示考试、主要按钮（跳路由表里的页面或提示“即将上线”）。
// 文案从 i18n 文件读、示例数字从 fixture 读，不在测试里抄一份。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URLS, ROOT } from "../support/env.ts";

interface P01Copy {
  readonly title: string;
  readonly soon: string;
  readonly scope: string;
  readonly alertsBadge: string;
  readonly northStar: { readonly label: string; readonly dictionary: string };
  readonly funnel: { readonly title: string };
  readonly retention: {
    readonly title: string;
    readonly dimensions: Readonly<Record<string, string>>;
    readonly groups: Readonly<Record<string, string>>;
  };
  readonly alerts: { readonly title: string; readonly handle: string; readonly pages: Readonly<Record<string, string>> };
  readonly state: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
interface P01File {
  readonly normal: {
    readonly cockpit: { readonly exam_name: string; readonly open_alert_count: number; readonly retention: { readonly day: number } };
  };
}

const read = <T>(path: string): T => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as T;
const copy = read<P01Copy>("apps/admin/src/i18n/zh-CN/P01.json");
const EXAMS = { kj: "junior-accounting", js: "teacher-qualification", en: "cet-6", ds: "ds-final-custom" } as const;
const cockpit = (id: string) => read<P01File>(`fixtures/pages/P01/${id}.json`).normal.cockpit;
const fill = (template: string, values: Readonly<Record<string, string | number>>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_whole, key: string) => String(values[key] ?? ""));
const open = (page: Page, query = "") => page.goto(`${APP_URLS.admin}/cockpit${query}`);
const main = (page: Page) => page.locator("main#main");
const STATE_TEXT: Readonly<Record<string, string | undefined>> = {
  loading: undefined,
  empty: copy.state["empty"]?.["body"],
  error: copy.state["error"]?.["body"],
  offline: copy.state["offline"]?.["title"],
  restricted: copy.state["restricted"]?.["body"],
  insufficient_data: copy.state["insufficient_data"]?.["body"],
};

test.describe("P01 运营驾驶舱", () => {
  for (const width of [375, 834, 1280]) {
    test(`宽 ${width}：北极星、留存、漏斗、告警都在，正文不横向溢出；宽屏告警在右栏`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      const day = cockpit(EXAMS.kj).retention.day;
      const retention = main(page).getByRole("heading", {
        name: fill(copy.retention.title, { dimension: copy.retention.dimensions["map_source"] ?? "", day }),
      });
      const alerts = main(page).getByRole("heading", { name: copy.alerts.title, exact: true });
      await expect(main(page).getByText(copy.northStar.label, { exact: true })).toBeVisible();
      await expect(retention).toBeVisible();
      await expect(main(page).getByRole("heading", { name: copy.funnel.title })).toBeVisible();
      await expect(alerts).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const left = await retention.boundingBox();
      const right = await alerts.boundingBox();
      if (left === null || right === null) throw new Error("找不到留存或告警卡片");
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
    test(`演示考试 ?exam=${key}：考试范围与告警数来自假数据`, async ({ page }) => {
      await open(page, `?exam=${key}`);
      const data = cockpit(id);
      await expect(main(page)).toContainText(fill(copy.scope, { exam: data.exam_name }));
      await expect(main(page)).toContainText(fill(copy.alertsBadge, { n: data.open_alert_count }));
    });
  }

  test("主要按钮：切分群维度；“处理”提示即将上线；相关页面跳路由表里的地址", async ({ page }) => {
    await open(page);
    await main(page)
      .getByRole("radio", { name: copy.retention.dimensions["channel"] ?? "" })
      .click();
    await expect(main(page).getByText(copy.retention.groups["app_store"] ?? "", { exact: true })).toBeVisible();
    await main(page).getByRole("button", { name: copy.alerts.handle, exact: true }).first().click();
    await expect(page.getByRole("status").filter({ hasText: copy.soon })).toBeVisible();
    await main(page)
      .getByRole("link", { name: copy.alerts.pages["P12"] ?? "" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/ai-evals$/);
  });

  test("口径链接跳到数据中台；空态与受限态的按钮可用", async ({ page }) => {
    await open(page);
    await main(page)
      .getByRole("link", { name: fill(copy.northStar.dictionary, { version: "v3" }) })
      .click();
    await expect(page).toHaveURL(/\/data-hub$/);
    await expect(page.getByRole("heading", { level: 1, name: "数据中台" })).toBeVisible();
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
