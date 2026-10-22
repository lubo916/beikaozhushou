// 题号导航（共用作答组件，S18-05 纸笔动作之一）：每题一个圆点，颜色之外读屏念“第 n 题，做对”，颜色不是唯一信息；标记过的加一圈。
import { fill } from "../lib/copy.ts";
import { cx } from "../lib/cx.ts";
import copy from "./copy.zh-CN.json";

export type NavStatus = "unanswered" | "answered" | "correct" | "wrong" | "ungraded";

export interface QuestionNavItem {
  readonly key: string;
  readonly status: NavStatus;
  readonly flagged?: boolean | undefined;
}

export interface QuestionNavProps {
  items: readonly QuestionNavItem[];
  current: number;
  onSelect: (index: number) => void;
  /** dark：放在沉浸页的深色顶栏里；light：放在浅色卡片里。 */
  tone?: "dark" | "light" | undefined;
  className?: string | undefined;
}

const DOT: Readonly<Record<NavStatus, string>> = {
  unanswered: "border-ink-tertiary",
  answered: "border-brand-primary bg-brand-primary-soft text-brand-primary-ink",
  correct: "border-status-success bg-status-success text-bg-surface",
  wrong: "border-status-danger bg-status-danger text-bg-surface",
  ungraded: "border-status-warning bg-status-warning-soft text-status-warning",
};

const HERE: Readonly<Record<"dark" | "light", string>> = {
  dark: "border-bg-surface bg-bg-surface font-bold text-ink-primary",
  light: "border-brand-primary bg-brand-primary font-bold text-bg-surface",
};

export function QuestionNav({ items, current, onSelect, tone = "dark", className }: QuestionNavProps) {
  return (
    <nav aria-label={copy.nav.label} className={cx("min-w-[0] overflow-x-auto", className)}>
      <ol className="flex items-center gap-1">
        {items.map((item, index) => {
          const here = index === current;
          const name = fill(item.flagged === true ? copy.nav.item_flagged : copy.nav.item, {
            n: index + 1,
            status: copy.nav.status[item.status],
          });
          return (
            <li key={item.key}>
              <button
                type="button"
                aria-label={name}
                title={name}
                aria-current={here ? "step" : undefined}
                onClick={() => onSelect(index)}
                className={cx(
                  "flex size-7 items-center justify-center rounded-full border text-small tabular-nums",
                  here ? HERE[tone] : DOT[item.status],
                  item.flagged === true && "ring-2 ring-status-warning-line",
                )}
              >
                {index + 1}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
