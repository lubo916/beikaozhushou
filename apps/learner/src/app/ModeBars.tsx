// 三种特殊页面模式的顶栏（ui-rules 第 3 节）：
// 引导页——步骤条（欢迎、备考目标、时间与资料、摸底、起点报告），只有“上一步”“跳过”；
// 沉浸页——隐藏导航，只留“退出”与进度（进度由页面用 ImmersiveProgress 放进来）；
// 独立页——只有标志与“返回”（有上一页时才显示“返回”）。
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router";
import { buttonClass, cx } from "@exam-prep/ui";
import { HOME_ID, pathTo } from "../routes.ts";
import { ONBOARDING_STEPS, type PageMeta } from "../router/pages.ts";
import { ShellIcon } from "./icons.tsx";

/** 有上一页就退回上一页，否则回今日（直接打开链接时没有上一页）。 */
function useLeave(): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key !== "default") void navigate(-1);
    else void navigate(pathTo(HOME_ID));
  };
}

export function GuidedBar({ page }: { page: PageMeta }) {
  const { t } = useTranslation();
  const index = ONBOARDING_STEPS.indexOf(page.id);
  const prev = index > 0 ? ONBOARDING_STEPS[index - 1] : undefined;
  const next = index >= 0 ? ONBOARDING_STEPS[index + 1] : undefined;
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-line-soft bg-bg-surface px-3 py-2 @tablet:px-6 @tablet:py-3">
      <span className="hidden shrink-0 font-serif text-title font-bold text-brand-primary-ink @desktop:inline">{t("app.product")}</span>
      <ol aria-label={t("shell.guided.steps")} className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
        {ONBOARDING_STEPS.map((id, i) => {
          const current = i === index;
          return (
            <li
              key={id}
              aria-current={current ? "step" : undefined}
              className={cx(
                "shrink-0 items-center rounded-full border px-3 py-1 text-small",
                current ? "flex border-brand-primary bg-brand-primary font-bold text-bg-surface" : "hidden @tablet:flex",
                i < index && "border-status-success-soft bg-status-success-soft text-status-success",
                i > index && "border-line-strong bg-bg-surface text-ink-secondary",
              )}
            >
              {t("shell.guided.step", { n: i + 1, name: t(`steps.${id}`) })}
            </li>
          );
        })}
      </ol>
      <div className="flex shrink-0 items-center gap-2">
        {prev !== undefined && (
          <Link to={pathTo(prev)} className={buttonClass("secondary", "sm")}>
            {t("shell.guided.prev")}
          </Link>
        )}
        <Link to={pathTo(next ?? HOME_ID)} className={buttonClass("ghost", "sm")}>
          {t("shell.guided.skip")}
        </Link>
      </div>
    </header>
  );
}

export function ImmersiveBar({ name, onSlot }: { name: string; onSlot: (node: HTMLElement | null) => void }) {
  const { t } = useTranslation();
  const leave = useLeave();
  return (
    <header className="flex shrink-0 items-center gap-3 bg-ink-primary px-3 py-2 text-bg-surface @tablet:px-6">
      <button
        type="button"
        onClick={leave}
        className="shrink-0 rounded-sm border border-ink-tertiary px-3 py-1 text-small hover:bg-ink-secondary"
      >
        {t("shell.immersive.exit")}
      </button>
      <p className="min-w-0 flex-1 truncate font-bold">{name}</p>
      <div ref={onSlot} className="flex shrink-0 items-center gap-3 text-small" />
    </header>
  );
}

export function StandaloneBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-line-soft bg-bg-surface px-3 py-3">
      <span>
        {location.key !== "default" && (
          <button type="button" onClick={() => void navigate(-1)} className="inline-flex items-center gap-1 text-small text-brand-primary">
            <ShellIcon name="back" />
            {t("shell.standalone.back")}
          </button>
        )}
      </span>
      <span className="font-serif text-title font-bold text-brand-primary-ink">{t("app.product")}</span>
      <span />
    </header>
  );
}
