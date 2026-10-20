/** 组件内部用的几个线性图标（lucide 还没装，装上后可替换）；都是装饰，读屏跳过。 */
const PATHS = {
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7",
  chevron: "M9 6l6 6-6 6",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  undo: "M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3",
  alert: "M12 8v5M12 16.5v.5M10.3 3.9L2.6 17.4A2 2 0 004.3 20.4h15.4a2 2 0 001.7-3l-7.7-13.5a2 2 0 00-3.4 0z",
  info: "M12 11v6M12 7.5v.5M12 21a9 9 0 100-18 9 9 0 000 18z",
  lock: "M7 11V8a5 5 0 0110 0v3M5.5 11h13v9.5h-13z",
  offline: "M2 8.5a15 15 0 0115.5-3.2M5.5 12.2a10 10 0 017.2-2.4M9 15.8a5 5 0 016 0M12 19.5h.01M3 3l18 18",
  inbox: "M3 13h5l1.5 3h5l1.5-3h5M5.5 5h13L21 13v6H3v-6z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  clock: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z",
} as const;

export type IconName = keyof typeof PATHS;

export interface IconProps {
  name: IconName;
  filled?: boolean | undefined;
}

export function Icon({ name, filled = false }: IconProps) {
  return (
    <svg
      className="ui-icon"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
