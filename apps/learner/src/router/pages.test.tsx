// 路由表与页面登记对照 docs/baseline/pages.md（路由以 pages.md 为准）：页面、路径、分组、视图、功能点数量一一对上；
// 每页都有空壳入口与文案文件。
import { describe, expect, it } from "vitest";
import pagesMd from "../../../../docs/baseline/pages.md?raw";
import { VOCAB } from "@exam-prep/shared/vocab";
import common from "../i18n/zh-CN/common.json";
import { ROUTES, pathTo } from "../routes.ts";
import { ONBOARDING_STEPS, PAGES, TABS, findPage, resolveView } from "./pages.ts";

interface Row {
  readonly id: string;
  readonly name: string;
  readonly group: string;
  readonly route: string;
  readonly mode: string;
  readonly views: readonly string[];
  readonly features: readonly number[];
}

function rows(section: string): Row[] {
  const start = pagesMd.indexOf(section);
  const rest = pagesMd.slice(start + section.length);
  const end = rest.indexOf("\n## ");
  const body = end < 0 ? rest : rest.slice(0, end);
  return body
    .split("\n")
    .filter((line) => /^\| [SOP]\d{2} \|/.test(line))
    .map((line) => {
      const [id = "", name = "", group = "", route = "", mode = "", views = "", features = ""] = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      return {
        id,
        name,
        group,
        route: route.replaceAll("`", ""),
        mode,
        views: views === "—" ? [] : views.split("；").map((item) => item.trim().split(" ")[0] ?? ""),
        features: features.split("/").map(Number),
      };
    });
}

const table = rows("## 学员端");
const names = common.page as Readonly<Record<string, string>>;
const groups = common.group as Readonly<Record<string, string>>;
const viewNames = common.view as Readonly<Record<string, Readonly<Record<string, string>>>>;
const EXTENSION = "（扩展包）";

describe("学员端路由表与 pages.md 一致", () => {
  it("35 页，顺序与页 ID 一致", () => {
    expect(table).toHaveLength(35);
    expect(PAGES.map((page) => page.id)).toEqual(table.map((row) => row.id));
  });

  it.each(table)("$id $name：路径、页名、分组、视图、功能点", (row) => {
    const page = PAGES.find((item) => item.id === row.id);
    expect(page).toBeDefined();
    if (page === undefined) return;
    expect(page.path).toBe(row.route);
    expect(ROUTES[page.id]).toBe(row.route);
    expect(names[page.id]).toBe(row.name.replace(EXTENSION, ""));
    expect(page.extension).toBe(row.name.endsWith(EXTENSION));
    expect(groups[page.group]).toBe(row.group);
    expect(page.views.map((item) => item.key)).toEqual(row.views);
    expect([...page.features]).toEqual(row.features);
    for (const item of page.views) expect(viewNames[page.id]?.[item.key]).toBeTruthy();
    // 表里写到的模式都要出现在本页（默认模式或某个视图的模式）
    const modes = new Set([page.mode, ...page.views.map((item) => item.mode)].map((mode) => VOCAB.page_mode[mode]));
    for (const label of Object.values(VOCAB.page_mode)) if (row.mode.includes(label)) expect(modes.has(label)).toBe(true);
    if (page.views.length > 0) expect(page.mode).toBe(page.views[0]?.mode);
  });

  it("每页都有空壳入口 pages/<页ID>/index.tsx 与文案文件 i18n/zh-CN/<页ID>.json", () => {
    const entries = Object.keys(import.meta.glob("../pages/*/index.tsx")).sort();
    const copies = Object.keys(import.meta.glob("../i18n/zh-CN/*.json")).sort();
    expect(entries).toEqual(PAGES.map((page) => `../pages/${page.id}/index.tsx`).sort());
    expect(copies).toEqual(["../i18n/zh-CN/common.json", ...PAGES.map((page) => `../i18n/zh-CN/${page.id}.json`)].sort());
  });

  it("底部五个标签与入门五步", () => {
    expect(TABS.map((tab) => [tab.page, common.tab[tab.key]])).toEqual([
      ["S06", "今日"],
      ["S09", "学习"],
      ["S17", "练测"],
      ["S28", "导师"],
      ["S34", "我的"],
    ]);
    expect(ONBOARDING_STEPS).toEqual(table.filter((row) => row.group === "入门").map((row) => row.id));
  });
});

describe("按地址找页面与填参数", () => {
  it("带参数的路由也能认出来，相近的路径不混", () => {
    expect(findPage("/kp/k-1")?.id).toBe("S10");
    expect(findPage("/mock")?.id).toBe("S22");
    expect(findPage("/mock/report/r1")?.id).toBe("S23");
    expect(findPage("/quiz/demo")?.id).toBe("S18");
    expect(findPage("/today/extra")).toBeUndefined();
    expect(findPage("/nope")).toBeUndefined();
  });

  it("pathTo 没给参数时用 demo，给了就编码后填进去", () => {
    expect(pathTo("S06")).toBe("/today");
    expect(pathTo("S10")).toBe("/kp/demo");
    expect(pathTo("S23", { reportId: "a b" })).toBe("/mock/report/a%20b");
  });

  it("视图：?view= 优先，其次是页面选的，否则第一个", () => {
    const today = PAGES.find((page) => page.id === "S06");
    if (today === undefined) throw new Error("缺 S06");
    expect(resolveView(today, null, null)?.key).toBe("normal");
    expect(resolveView(today, null, "done")?.key).toBe("done");
    expect(resolveView(today, "off", "done")?.key).toBe("off");
    expect(resolveView(today, "不存在", null)?.key).toBe("normal");
  });
});
