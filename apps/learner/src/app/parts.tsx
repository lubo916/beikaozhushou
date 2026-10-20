// 外壳的小部件：分组字标、一组页面链接（桌面侧栏、平板弹出层、手机抽屉共用）与“显示哪些分组”的规则。
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { cx } from "@exam-prep/ui";
import { pathTo } from "../routes.ts";
import { NAV_GROUPS, pagesInGroup, type NavGroup, type PageMeta } from "../router/pages.ts";

/** 分组与标签的圆形字标（今、学、记……）：装饰，读屏跳过。 */
export function Badge({ text, active = false }: { text: string; active?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-small font-bold",
        active ? "border-brand-primary bg-brand-primary text-bg-surface" : "border-line-strong bg-bg-surface text-ink-secondary",
      )}
    >
      {text}
    </span>
  );
}

/** 入门分组只在还没走完入门时出现（pages.md「学员端导航」）。 */
export function visibleGroups(onboarding: boolean): readonly NavGroup[] {
  return NAV_GROUPS.filter((group) => group !== "onboarding" || onboarding);
}

/** 扩展包页面只在当前考试启用了对应扩展时出现在导航里；接口还没给扩展信息，先不放进导航（地址照样能打开）。 */
export function navPages(group: NavGroup): readonly PageMeta[] {
  return pagesInGroup(group).filter((page) => !page.extension);
}

export interface GroupLinksProps {
  readonly group: NavGroup;
  readonly labelledBy?: string | undefined;
  readonly onNavigate?: (() => void) | undefined;
}

export function GroupLinks({ group, labelledBy, onNavigate }: GroupLinksProps) {
  const { t } = useTranslation();
  return (
    <ul aria-labelledby={labelledBy} className="flex flex-col gap-1">
      {navPages(group).map((page) => (
        <li key={page.id}>
          <NavLink
            to={pathTo(page.id)}
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                "block rounded-sm px-3 py-1",
                isActive
                  ? "bg-brand-primary-soft font-bold text-brand-primary-ink"
                  : "text-ink-secondary hover:bg-bg-sunk hover:text-ink-primary",
              )
            }
          >
            {t(`page.${page.id}`)}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
