// 路由表与页面登记对照 docs/baseline/pages.md（路由以 pages.md 为准）：页面、路径、页名、分组、功能点数量一一对上；每页都有空壳与文案文件。
import { describe, expect, it } from "vitest";
import pagesMd from "../../../../docs/baseline/pages.md?raw";
import { i18n } from "../i18n/index.ts";
import { ROUTES, pathTo } from "../routes.ts";
import { matchRoute } from "./history.tsx";
import { NAME_VALUES, PAGES, findPage } from "./pages.ts";

const SECTION = "## 平台后台";
const COUNT = 19;

function rows() {
  const rest = pagesMd.slice(pagesMd.indexOf(SECTION) + SECTION.length);
  const end = rest.indexOf("\n## ");
  return (end < 0 ? rest : rest.slice(0, end))
    .split("\n")
    .filter((line) => /^\| [SOP]\d{2} \|/.test(line))
    .map((line) => {
      const [id = "", name = "", group = "", route = "", , , features = ""] = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      return { id, name, group, route: route.replaceAll("`", ""), features: features.split("/").map(Number) };
    });
}

const table = rows();

describe("路由表与 pages.md 一致", () => {
  it("页数与顺序", () => {
    expect(table).toHaveLength(COUNT);
    expect(PAGES.map((page) => page.id)).toEqual(table.map((row) => row.id));
  });

  it.each(table)("$id $name：路径、页名、分组、功能点", (row) => {
    const page = PAGES.find((item) => item.id === row.id);
    if (page === undefined) throw new Error(`登记里缺 ${row.id}`);
    expect(page.path).toBe(row.route);
    expect(ROUTES[page.id]).toBe(row.route);
    expect(i18n.t(`page.${page.id}`, { ...NAME_VALUES[page.id] })).toBe(row.name);
    expect(i18n.t(`group.${page.group}`)).toBe(row.group);
    expect([...page.features]).toEqual(row.features);
  });

  it("每页都有空壳入口与文案文件", () => {
    const entries = Object.keys(import.meta.glob("../pages/*/index.tsx")).sort();
    const copies = Object.keys(import.meta.glob("../i18n/zh-CN/*.json")).sort();
    expect(entries).toEqual(PAGES.map((page) => `../pages/${page.id}/index.tsx`).sort());
    expect(copies).toEqual(["../i18n/zh-CN/common.json", ...PAGES.map((page) => `../i18n/zh-CN/${page.id}.json`)].sort());
  });
});

describe("路由匹配", () => {
  it("带参数的路由与填参数", () => {
    const withParam = PAGES.find((page) => page.path.includes(":"));
    if (withParam !== undefined) {
      expect(findPage(pathTo(withParam.id))?.id).toBe(withParam.id);
      expect(findPage(pathTo(withParam.id, { x: "1" }))?.id).toBe(withParam.id);
    }
    expect(matchRoute("/students/:studentId", "/students/a%20b")).toEqual({ studentId: "a b" });
    expect(matchRoute("/students/:studentId", "/students")).toBeNull();
    expect(matchRoute("/students/:studentId", "/students/%E0%A4%A")).toBeNull();
    expect(findPage("/nope")).toBeUndefined();
  });
});
