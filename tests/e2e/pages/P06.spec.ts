// P06 变更影响分析冒烟（W03）：三档宽度布局、每个 ?state=、四个演示考试、主要按钮（类型筛选、空态清除筛选、登记/分派/通知提示即将上线、受限出路）。
// 文案从 i18n 文件读、示例内容从 fixture 读，不在测试里抄一份。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URLS, ROOT } from "../support/env.ts";

interface P06Copy {
  readonly soon: string;
  readonly scope: string;
  readonly actions: { readonly register: string; readonly assign: string };
  readonly kinds: Readonly<Record<string, string>>;
  readonly events: { readonly title: string };
  readonly pending: { readonly marked: string };
  readonly notices: { readonly title: string; readonly notifyLearners: string; readonly notifyAuthors: string };
  readonly state: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
interface P06Event {
  readonly title: string;
  readonly kind: string;
}
interface P06File {
  readonly impact: {
    readonly exam_name: string;
    readonly events: readonly P06Event[];
    readonly analysis: { readonly sample_sufficient: boolean };
  };
}

const read = <T>(path: string): T => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as T;
const copy = read<P06Copy>("apps/admin/src/i18n/zh-CN/P06.json");
const EXAMS = { kj: "junior-accounting", js: "teacher-qualification", en: "cet-6", ds: "ds-final-custom" } as const;
const impact = (id: string) => read<P06File>(`fixtures/pages/P06/${id}.json`).impact;
const eventOf = (id: string, kind: string) => {
  const found = impact(id).events.find((event) => event.kind === kind);
  if (found === undefined) throw new Error(`fixture 缺少类型 ${kind} 的变更事件`);
  return found.title;
};
const open = (page: Page, query = "") => page.goto(`${APP_URLS.admin}/impact${query}`);
const main = (page: Page) => page.locator("main#main");
const STATE_TEXT: Readonly<Record<string, string | undefined>> = {
  loading: undefined,
  empty: copy.state["empty"]?.["body"],
  error: copy.state["error"]?.["body"],
  offline: copy.state["offline"]?.["title"],
  restricted: copy.state["restricted"]?.["body"],
  insufficient_data: copy.state["insufficient_data"]?.["body"],
};

test.describe("P06 变更影响分析", () => {
  for (const width of [375, 834, 1280]) {
    test(`宽 ${width}：变更事件与通知卡都在，正文不横向溢出；宽屏通知在右栏`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      const events = main(page).getByRole("heading", { name: copy.events.title, exact: true });
      const notices = main(page).getByRole("heading", { name: copy.notices.title, exact: true });
      await expect(events).toBeVisible();
      await expect(notices).toBeVisible();
      await expect(main(page).getByText(eventOf(EXAMS.kj, "syllabus")).first()).toBeVisible();
      await expect(main(page).getByText(copy.pending.marked, { exact: true }).first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const left = await events.boundingBox();
      const right = await notices.boundingBox();
      if (left === null || right === null) throw new Error("找不到变更事件或通知卡片");
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
    test(`演示考试 ?exam=${key}：考试范围与变更事件随考试变化`, async ({ page }) => {
      await open(page, `?exam=${key}`);
      const data = impact(id);
      await expect(main(page)).toContainText(copy.scope.replace("{{exam}}", data.exam_name));
      await expect(
        main(page)
          .getByText(data.events[0]?.title ?? "")
          .first(),
      ).toBeVisible();
      await expect(main(page).locator(".ui-state--insufficient_data")).toHaveCount(data.analysis.sample_sufficient ? 0 : 1);
    });
  }

  test("主要按钮：按类型筛选；登记、分派、通知学员、提醒模板作者提示“即将上线”", async ({ page }) => {
    await open(page);
    const syllabus = eventOf(EXAMS.kj, "syllabus");
    await expect(main(page).getByText(syllabus).first()).toBeVisible();
    await main(page)
      .getByRole("button", { name: new RegExp(`^${copy.kinds["textbook"] ?? ""}`) })
      .click();
    await expect(main(page).getByText(eventOf(EXAMS.kj, "textbook")).first()).toBeVisible();
    await expect(main(page).getByText(syllabus, { exact: true })).toHaveCount(0);
    await main(page)
      .getByRole("button", { name: new RegExp(`^${copy.kinds["syllabus"] ?? ""}`) })
      .click();
    await expect(main(page).getByText(syllabus).first()).toBeVisible();
    for (const name of [copy.actions.register, copy.actions.assign, copy.notices.notifyLearners, copy.notices.notifyAuthors]) {
      await main(page).getByRole("button", { name, exact: true }).first().click();
      await expect(page.getByText(copy.soon)).toBeVisible();
    }
  });

  test("某类型没有事件时显示空态，清除筛选后恢复", async ({ page }) => {
    await open(page, "?exam=ds");
    const only = impact(EXAMS.ds).events[0]?.title ?? "";
    await expect(main(page).getByText(only).first()).toBeVisible();
    await main(page)
      .getByRole("button", { name: new RegExp(`^${copy.kinds["rule"] ?? ""}`) })
      .click();
    await expect(main(page).locator(".ui-state--empty")).toBeVisible();
    await main(page)
      .getByRole("button", { name: copy.state["empty"]?.["action"] ?? "" })
      .click();
    await expect(main(page).getByText(only).first()).toBeVisible();
  });

  test("受限态给出路：去系统、参数与权限", async ({ page }) => {
    await open(page, "?state=restricted");
    await main(page)
      .getByRole("link", { name: copy.state["restricted"]?.["action"] ?? "" })
      .click();
    await expect(page).toHaveURL(/\/system$/);
  });
});
