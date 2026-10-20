// 主题清空了 Tailwind 的默认间距（tailwind-theme.css 只登记 size.space 的 1–6、8、10、12 档），
// 所以 bottom-0、min-h-0、gap-7 这类不在阶梯里的间距类不会生成任何样式——F04 的开发工具条就因为 bottom-0 不生效跑到了屏幕外。
// 零请写任意值 [0]（如 bottom-[0]、min-h-[0]），其他数值用登记的阶梯。本测试扫描学员端源码（测试文件除外）里的类名。
import { describe, expect, it } from "vitest";

const SOURCES = import.meta.glob<string>(["../**/*.tsx", "!../**/*.test.tsx"], { query: "?raw", import: "default", eager: true });
const STEPS = new Set(["1", "2", "3", "4", "5", "6", "8", "10", "12"]);
const SPACING = [
  "p",
  "px",
  "py",
  "pt",
  "pr",
  "pb",
  "pl",
  "ps",
  "pe",
  "m",
  "mx",
  "my",
  "mt",
  "mr",
  "mb",
  "ml",
  "ms",
  "me",
  "gap",
  "gap-x",
  "gap-y",
  "space-x",
  "space-y",
  "inset",
  "inset-x",
  "inset-y",
  "top",
  "right",
  "bottom",
  "left",
  "start",
  "end",
  "w",
  "h",
  "size",
  "min-w",
  "min-h",
  "max-w",
  "max-h",
  "translate-x",
  "translate-y",
  "basis",
  "scroll-m",
  "scroll-p",
  "indent",
].join("|");
const CLASS = new RegExp(`^(?:[\\w@\\[\\]&>/-]*:)?-?(?:${SPACING})-(\\d+(?:\\.\\d+)?)$`);

/** 源码字符串里不在间距阶梯上的类名。 */
function unknownSpacing(source: string): string[] {
  const strings = source.match(/"[^"\n]*"|`[^`]*`/g) ?? [];
  return strings
    .flatMap((text) => text.slice(1, -1).split(/\s+/))
    .filter((token) => {
      const match = CLASS.exec(token);
      return match !== null && !STEPS.has(match[1] ?? "");
    });
}

describe("间距类只用登记的阶梯（不在阶梯上的类不会生成样式）", () => {
  it("自检：认得出零值与阶梯外的间距类，任意值与阶梯内的不算", () => {
    const sample = '<div className="fixed bottom-0 left-0 z-50 p-2 @tablet:min-h-0 gap-7 top-[0] -mt-2 size-12 translate-y-1/2" />';
    expect(unknownSpacing(sample)).toEqual(["bottom-0", "left-0", "@tablet:min-h-0", "gap-7"]);
  });

  it.each(Object.keys(SOURCES).sort())("%s", (path) => {
    expect(unknownSpacing(SOURCES[path] ?? "")).toEqual([]);
  });
});
