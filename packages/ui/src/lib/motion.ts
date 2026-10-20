import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** 用户是否开了“减少动效”。组件的过渡与动画已在样式里统一关掉；这个钩子给需要用脚本做动效的地方用。 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}
