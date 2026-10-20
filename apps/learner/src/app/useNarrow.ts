import { useEffect, useState, type RefObject } from "react";

/** 外壳容器是否窄于平板断点（令牌 size.breakpoint.tablet）。只给脚本里要分辨手机布局的地方用（导师面板从底部还是右侧出来）；样式一律用容器查询。 */
export function useNarrow(ref: RefObject<HTMLElement | null>): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    const limit = Number.parseFloat(getComputedStyle(element).getPropertyValue("--size-breakpoint-tablet"));
    const update = () => setNarrow(Number.isFinite(limit) && element.clientWidth < limit);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return narrow;
}
