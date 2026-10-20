// 外壳用的几个线性图标（菜单、搜索、通知、加号、返回、退出登录）。都是装饰，读屏跳过，按钮自己带名称。
// packages/ui 的 Icon 还没有这几个，交接单里建议整合任务并进公共图标。
const PATHS = {
  menu: "M4 7h16M4 12h16M4 17h16",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  bell: "M6 16v-5a6 6 0 0112 0v5l1.5 2h-15zM10 20.5a2 2 0 004 0",
  plus: "M12 5v14M5 12h14",
  back: "M15 6l-6 6 6 6",
  logout: "M10 5H5v14h5M14 8l4 4-4 4M18 12H9",
} as const;

export type ShellIconName = keyof typeof PATHS;

export function ShellIcon({ name }: { name: ShellIconName }) {
  return (
    <svg
      className="ui-icon"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
