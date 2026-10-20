import { afterEach, describe, expect, it } from "vitest";
import "./generated/tokens.css";
import "./styles/components.css";
import { Button } from "./basic/Button.tsx";
import { mount, type Mounted } from "./testing.tsx";

let view: Mounted | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
});

function rules(list: CSSRuleList): CSSRule[] {
  return [...list].flatMap((rule) => ("cssRules" in rule ? [rule, ...rules((rule as CSSGroupingRule).cssRules)] : [rule]));
}

describe("可访问性与动效", () => {
  it("键盘焦点可见：按钮获得键盘焦点时画出主色焦点框", async () => {
    view = await mount(<Button>开始</Button>);
    const button = view.host.querySelector("button");
    button?.focus();
    expect(button?.matches(":focus-visible")).toBe(true);
    const style = getComputedStyle(button as Element);
    expect(style.outlineStyle).toBe("solid");
    expect(style.outlineWidth).toBe("2px");
  });

  it("尊重“减少动效”：样式里有统一关掉动画与过渡的规则", () => {
    const all = [...document.styleSheets].flatMap((sheet) => rules(sheet.cssRules));
    const reduce = all.filter((rule) => rule instanceof CSSMediaRule && rule.conditionText.includes("prefers-reduced-motion: reduce"));
    expect(reduce.length).toBeGreaterThan(0);
    const text = reduce.map((rule) => rule.cssText).join("\n");
    expect(text).toContain("ui-");
    expect(text).toContain("animation-duration");
    expect(text).toContain("transition-duration");
  });
});
