// P05 考情分析工作台冒烟（W03）：三档宽度布局、每个 ?state=、四个演示考试、主要按钮（来源筛选、空态清除筛选、真题入库与确认关联提示即将上线、受限出路）。
// 文案从 i18n 文件读、示例内容从 fixture 读，不在测试里抄一份。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { APP_URLS, ROOT } from "../support/env.ts";

interface P05Copy {
  readonly soon: string;
  readonly scope: string;
  readonly actions: { readonly import: string };
  readonly sources: Readonly<Record<string, string>>;
  readonly link: { readonly confirm: string };
  readonly questions: { readonly title: string; readonly caption: string };
  readonly profile: { readonly title: string };
  readonly maturity: { readonly title: string };
  readonly wording: { readonly title: string };
  readonly state: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
interface P05Question {
  readonly source: string;
  readonly knowledge_point: { readonly name: string };
}
interface P05File {
  readonly analysis: {
    readonly exam_name: string;
    readonly questions: readonly P05Question[];
    readonly profile: { readonly sample_sufficient: boolean; readonly entries: readonly { readonly name: string }[] };
  };
}

const read = <T>(path: string): T => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as T;
const copy = read<P05Copy>("apps/admin/src/i18n/zh-CN/P05.json");
const EXAMS = { kj: "junior-accounting", js: "teacher-qualification", en: "cet-6", ds: "ds-final-custom" } as const;
const analysis = (id: string) => read<P05File>(`fixtures/pages/P05/${id}.json`).analysis;
const pointOf = (id: string, source: string) => {
  const found = analysis(id).questions.find((item) => item.source === source);
  if (found === undefined) throw new Error(`fixture 缺少来源 ${source} 的真题`);
  return found.knowledge_point.name;
};
const open = (page: Page, query = "") => page.goto(`${APP_URLS.admin}/exam-analysis${query}`);
const main = (page: Page) => page.locator("main#main");
const chip = (page: Page, label: string | undefined) => main(page).getByRole("button", { name: new RegExp(`^${label ?? ""}`) });
const STATE_TEXT: Readonly<Record<string, string | undefined>> = {
  loading: undefined,
  empty: copy.state["empty"]?.["body"],
  error: copy.state["error"]?.["body"],
  offline: copy.state["offline"]?.["title"],
  restricted: copy.state["restricted"]?.["body"],
  insufficient_data: copy.state["insufficient_data"]?.["body"],
};

test.describe("P05 考情分析工作台", () => {
  for (const width of [375, 834, 1280]) {
    test(`宽 ${width}：真题拆解、考点档案、数据成熟度、禁用表述都在，正文不横向溢出；宽屏数据成熟度在右栏`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      const questions = main(page).getByRole("heading", { name: copy.questions.title, exact: true });
      const maturity = main(page).getByRole("heading", { name: copy.maturity.title, exact: true });
      await expect(questions).toBeVisible();
      await expect(maturity).toBeVisible();
      for (const title of [copy.profile.title, copy.wording.title])
        await expect(main(page).getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(main(page).getByText(pointOf(EXAMS.kj, "official_public")).first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const left = await questions.boundingBox();
      const right = await maturity.boundingBox();
      if (left === null || right === null) throw new Error("找不到真题拆解或数据成熟度卡片");
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
    test(`演示考试 ?exam=${key}：考试范围、真题与考点档案随考试变化`, async ({ page }) => {
      await open(page, `?exam=${key}`);
      const data = analysis(id);
      await expect(main(page)).toContainText(copy.scope.replace("{{exam}}", data.exam_name));
      await expect(
        main(page)
          .getByText(data.questions[0]?.knowledge_point.name ?? "")
          .first(),
      ).toBeVisible();
      if (data.profile.sample_sufficient) await expect(main(page)).toContainText(data.profile.entries[0]?.name ?? "");
      else await expect(main(page).locator(".ui-state--insufficient_data")).toBeVisible();
    });
  }

  test("主要按钮：按来源筛选；真题入库与确认关联提示“即将上线”", async ({ page }) => {
    await open(page);
    const official = pointOf(EXAMS.kj, "official_public");
    await expect(main(page).getByText(official).first()).toBeVisible();
    await chip(page, copy.sources["recalled"]).click();
    // 考点档案不随来源筛选变，只看真题拆解表里的行。
    const table = main(page).getByRole("region", { name: copy.questions.caption });
    await expect(table.getByText(pointOf(EXAMS.kj, "recalled")).first()).toBeVisible();
    await expect(table.getByText(official, { exact: true })).toHaveCount(0);
    await main(page).getByRole("button", { name: copy.actions.import }).click();
    await expect(page.getByText(copy.soon)).toBeVisible();
    await main(page).getByRole("button", { name: copy.link.confirm }).first().click();
    await expect(page.getByText(copy.soon)).toBeVisible();
  });

  test("某来源没有真题时显示空态，清除筛选后恢复", async ({ page }) => {
    await open(page, "?exam=ds");
    const licensed = pointOf(EXAMS.ds, "licensed");
    await expect(main(page).getByText(licensed).first()).toBeVisible();
    await chip(page, copy.sources["official_public"]).click();
    await expect(main(page).locator(".ui-state--empty")).toBeVisible();
    await main(page)
      .getByRole("button", { name: copy.state["empty"]?.["action"] ?? "" })
      .click();
    await expect(main(page).getByText(licensed).first()).toBeVisible();
  });

  test("受限态给出路：去系统、参数与权限", async ({ page }) => {
    await open(page, "?state=restricted");
    await main(page)
      .getByRole("link", { name: copy.state["restricted"]?.["action"] ?? "" })
      .click();
    await expect(page).toHaveURL(/\/system$/);
  });
});
