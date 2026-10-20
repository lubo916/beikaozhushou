import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Num, parseYaml, plain } from "./yaml.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

describe("精简 YAML 解析器", () => {
  it("块映射、块序列、行内列表与映射、注释与引号", () => {
    const text = [
      "# 文件头注释",
      "- name: a.b # 行尾注释",
      "  tags: [x, 'y z', \"w\"]",
      "  props: {k: v, n: 2}",
      "  url: docs/x.md#anchor",
      "- name: c",
      "  list:",
      "    - 1",
      "    - two",
      "  empty:",
    ].join("\n");
    expect(plain(parseYaml(text))).toEqual([
      { name: "a.b", tags: ["x", "y z", "w"], props: { k: "v", n: 2 }, url: "docs/x.md#anchor" },
      { name: "c", list: [1, "two"], empty: null },
    ]);
  });

  it("数字保留原文：1 是整数，1.0 不是", () => {
    const value = parseYaml("a: 1\nb: 1.0\nc: [0.5, -2]\n") as Record<string, Num>;
    expect(value["a"]).toBeInstanceOf(Num);
    expect(value["a"]?.integer).toBe(true);
    expect(value["b"]?.integer).toBe(false);
    expect(plain(value)).toEqual({ a: 1, b: 1, c: [0.5, -2] });
  });

  it("null、布尔、按 YAML 1.2 读作文字的 off 与带引号的数字", () => {
    expect(plain(parseYaml("a: null\nb: ~\nc: true\nd: false\ne: '1'\nf: off\ng: v1.0\n"))).toEqual({
      a: null,
      b: null,
      c: true,
      d: false,
      e: "1",
      f: "off",
      g: "v1.0",
    });
  });

  it("跨行的行内列表、与键同缩进的列表、只有一个行内值的文件", () => {
    expect(plain(parseYaml("a: [1,\n  2]\nb:\n- x\n- y\n"))).toEqual({ a: [1, 2], b: ["x", "y"] });
    expect(plain(parseYaml("# 空登记\n[]\n"))).toEqual([]);
  });

  it("不支持的写法直接报错，不静默读错", () => {
    expect(() => parseYaml("a: &x 1\n")).toThrow(/不支持/);
    expect(() => parseYaml("a: |\n  text\n")).toThrow(/不支持/);
    expect(() => parseYaml("a: 1\na: 2\n")).toThrow(/重复的键/);
    expect(() => parseYaml("a:\n\tb: 1\n")).toThrow(/制表符/);
    expect(() => parseYaml("a: 1\n  b: 2\n")).toThrow(/缩进不对/);
  });

  it("仓库里的登记文件都能读", () => {
    const screens = readdirSync(join(ROOT, "design/screens")).map((d) => `design/screens/${d}`);
    const dirs = ["contracts", "contracts/ai", "docs/product", ...screens];
    let count = 0;
    for (const dir of dirs) {
      if (dir.endsWith("ID_BASELINE")) continue;
      for (const name of readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".yaml"))) {
        expect(() => parseYaml(readFileSync(join(ROOT, dir, name), "utf8"), `${dir}/${name}`)).not.toThrow();
        count++;
      }
    }
    expect(count).toBeGreaterThan(80);
  });
});
