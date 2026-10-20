import type { ReactNode } from "react";
import { cx } from "../lib/cx.ts";

export type StatTone = "default" | "brand" | "success" | "warning" | "danger";

export interface StatProps {
  label: ReactNode;
  /** 已格式化的取值（用 @exam-prep/shared/format 的函数，数字来自接口）。 */
  value: ReactNode;
  unit?: ReactNode;
  /** 卡片上的问句，如“够不够”。 */
  question?: ReactNode;
  hint?: ReactNode;
  tone?: StatTone | undefined;
  className?: string | undefined;
}

/** 统计数（统计卡里的一个数）。 */
export function Stat({ label, value, unit, question, hint, tone = "default", className }: StatProps) {
  return (
    <div className={cx("ui-stat", tone !== "default" && `ui-stat--${tone}`, className)}>
      <span className="ui-stat__label">
        {label}
        {question !== undefined && <span className="ui-stat__question">{question}</span>}
      </span>
      <span className="ui-stat__value">
        {value}
        {unit !== undefined && <span className="ui-stat__unit">{unit}</span>}
      </span>
      {hint !== undefined && <span className="ui-stat__hint">{hint}</span>}
    </div>
  );
}

/** 一组统计数：按容器宽度自动排成一列或多列。 */
export function StatGroup({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return <div className={cx("ui-stats", className)}>{children}</div>;
}

export interface KeyValueItem {
  key: string;
  label: ReactNode;
  value: ReactNode;
}

/** 键值行：一组“名称—取值”。 */
export function KeyValueList({ items, className }: { items: readonly KeyValueItem[]; className?: string | undefined }) {
  return (
    <dl className={cx("ui-kv", className)}>
      {items.map((item) => (
        <div key={item.key} className="ui-kv__row">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface PageHeaderProps {
  title: ReactNode;
  /** 标题上方的路径、所属。 */
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** 标题下一行的属性标签。 */
  meta?: ReactNode;
  className?: string | undefined;
}

/** 页头：页名（h1）、路径、动作、属性标签。 */
export function PageHeader({ title, eyebrow, description, actions, meta, className }: PageHeaderProps) {
  return (
    <header className={cx("ui-pagehead", className)}>
      <div className="ui-pagehead__main">
        {eyebrow !== undefined && <p className="ui-pagehead__eyebrow">{eyebrow}</p>}
        <h1 className="ui-pagehead__title">{title}</h1>
        {description !== undefined && <p className="ui-pagehead__desc">{description}</p>}
      </div>
      {actions !== undefined && <div className="ui-pagehead__actions">{actions}</div>}
      {meta !== undefined && <div className="ui-pagehead__meta">{meta}</div>}
    </header>
  );
}

export interface TableColumn<R> {
  key: string;
  header: ReactNode;
  /** 窄屏叠成卡片时每格前面的名称。 */
  label?: string | undefined;
  render: (row: R) => ReactNode;
  align?: "start" | "end" | undefined;
}

export interface DataTableProps<R> {
  /** 表名（读屏用；captionVisible 时也显示）。 */
  caption: string;
  captionVisible?: boolean | undefined;
  columns: readonly TableColumn<R>[];
  rows: readonly R[];
  rowKey: (row: R) => string;
  empty?: ReactNode;
  /** 窄屏（容器 < 700）时每行叠成一张小卡。 */
  stackOnNarrow?: boolean | undefined;
  className?: string | undefined;
}

/** 表格：宽了在自身容器里横向滚动（可用键盘滚动）。 */
export function DataTable<R>({ caption, captionVisible = false, columns, rows, rowKey, empty, stackOnNarrow = false, className }: DataTableProps<R>) {
  return (
    <div className={cx("ui-table-wrap", className)} role="region" aria-label={caption} tabIndex={0}>
      <table className={cx("ui-table", stackOnNarrow && "ui-table--stack")}>
        <caption className={captionVisible ? undefined : "ui-visually-hidden"}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.align === "end" ? "ui-table__end" : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty !== undefined ? (
            <tr>
              <td colSpan={columns.length} className="ui-table__empty">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} data-label={column.label} className={column.align === "end" ? "ui-table__end" : undefined}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export interface BarItem {
  key: string;
  label: ReactNode;
  /** 原始取值（接口返回）；条的长短按 max 的比例画。 */
  value: number;
  /** 显示的取值文字（已格式化）。 */
  valueText: ReactNode;
  tone?: "brand" | "success" | "warning" | "danger" | "ai" | undefined;
}

/** 横条图：一组可比较的数（如错因分布）。 */
export function BarList({ label, items, max, className }: { label: string; items: readonly BarItem[]; max?: number | undefined; className?: string | undefined }) {
  const top = max ?? Math.max(0, ...items.map((item) => item.value));
  return (
    <ul className={cx("ui-bars", className)} aria-label={label}>
      {items.map((item) => (
        <li key={item.key} className={cx("ui-bars__item", item.tone !== undefined && `ui-bars__item--${item.tone}`)}>
          <span className="ui-bars__label">{item.label}</span>
          <span className="ui-bars__track" aria-hidden="true">
            <span className="ui-bars__fill" style={{ width: `${top > 0 ? Math.round((item.value / top) * 100) : 0}%` }} />
          </span>
          <span className="ui-bars__value">{item.valueText}</span>
        </li>
      ))}
    </ul>
  );
}

/** 容器查询的作用域：页面内容区包一层，里面的组件按这块区域的宽度（而不是屏幕宽度）切换布局。 */
export function ContainerScope({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return <div className={cx("ui-cq", className)}>{children}</div>;
}

/** 页面内双栏：容器 ≥ 860 时左右两栏（≥ 1180 时主栏更宽），窄了上下排。 */
export function Columns({ main, aside, className }: { main: ReactNode; aside?: ReactNode; className?: string | undefined }) {
  return (
    <div className={cx("ui-cols", aside !== undefined && "ui-cols--split", className)}>
      <div className="ui-cols__main">{main}</div>
      {aside !== undefined && <aside className="ui-cols__aside">{aside}</aside>}
    </div>
  );
}
