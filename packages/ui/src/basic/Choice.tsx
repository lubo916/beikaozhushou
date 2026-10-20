import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { formatNumber } from "@exam-prep/shared/format";
import { cx } from "../lib/cx.ts";
import { nextIndex } from "../lib/roving.ts";

export interface ChoiceOption<V extends string> {
  value: V;
  label: ReactNode;
  disabled?: boolean | undefined;
}

export interface SegmentedProps<V extends string> {
  /** 这组选项的名称（读屏用）。 */
  label: string;
  options: readonly ChoiceOption<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: "sm" | "md" | undefined;
  className?: string | undefined;
}

/** 分段选择（单选组）：方向键移动并选中，Home/End 到两端。 */
export function Segmented<V extends string>({ label, options, value, onChange, size = "md", className }: SegmentedProps<V>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const checked = options.findIndex((option) => option.value === value);
  const focusable = checked >= 0 ? checked : options.findIndex((option) => !option.disabled);
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextIndex(options, index, event.key);
    const option = next === null ? undefined : options[next];
    if (next === null || option === undefined) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(option.value);
  }
  return (
    <div role="radiogroup" aria-label={label} className={cx("ui-seg", size === "sm" && "ui-seg--sm", className)}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="button"
          role="radio"
          aria-checked={index === checked}
          tabIndex={index === focusable ? 0 : -1}
          disabled={option.disabled}
          className={cx("ui-seg__opt", index === checked && "ui-seg__opt--on")}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export interface TabItem<K extends string> {
  key: K;
  label: ReactNode;
  badge?: ReactNode;
  disabled?: boolean | undefined;
}

export interface TabsProps<K extends string> {
  label: string;
  items: readonly TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** 当前标签的面板内容。 */
  children?: ReactNode;
  className?: string | undefined;
}

/** 标签页：方向键切换（自动激活），面板与标签互相关联。 */
export function Tabs<K extends string>({ label, items, value, onChange, children, className }: TabsProps<K>) {
  const base = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = Math.max(
    0,
    items.findIndex((item) => item.key === value),
  );
  const panelId = `${base}-panel`;
  const tabId = (index: number) => `${base}-tab-${index}`;
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextIndex(items, index, event.key);
    const item = next === null ? undefined : items[next];
    if (next === null || item === undefined) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(item.key);
  }
  return (
    <div className={cx("ui-tabs", className)}>
      <div role="tablist" aria-label={label} className="ui-tablist">
        {items.map((item, index) => (
          <button
            key={item.key}
            ref={(element) => {
              refs.current[index] = element;
            }}
            id={tabId(index)}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-controls={children !== undefined ? panelId : undefined}
            tabIndex={index === active ? 0 : -1}
            disabled={item.disabled}
            className="ui-tab"
            onClick={() => onChange(item.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {item.label}
            {item.badge !== undefined && <span className="ui-tab__badge">{item.badge}</span>}
          </button>
        ))}
      </div>
      {children !== undefined && (
        <div id={panelId} role="tabpanel" aria-labelledby={tabId(active)} tabIndex={0} className="ui-tabpanel">
          {children}
        </div>
      )}
    </div>
  );
}

export interface FilterChipOption<V extends string> extends ChoiceOption<V> {
  /** 该筛选条件下的条数（接口返回）。 */
  count?: number | undefined;
}

export interface FilterChipsProps<V extends string> {
  label: string;
  options: readonly FilterChipOption<V>[];
  selected: readonly V[];
  onChange: (selected: V[]) => void;
  /** 多选（默认）；单选时点已选中的片不取消。 */
  multiple?: boolean | undefined;
  className?: string | undefined;
}

/** 筛选片：每片是一个开关按钮（aria-pressed）。 */
export function FilterChips<V extends string>({ label, options, selected, onChange, multiple = true, className }: FilterChipsProps<V>) {
  function toggle(value: V) {
    const on = selected.includes(value);
    if (!multiple) onChange([value]);
    else onChange(on ? selected.filter((item) => item !== value) : [...selected, value]);
  }
  return (
    <div role="group" aria-label={label} className={cx("ui-chips", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={selected.includes(option.value)}
          disabled={option.disabled}
          className="ui-chip"
          onClick={() => toggle(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span className="ui-chip__count">{formatNumber(option.count, 0)}</span>}
        </button>
      ))}
    </div>
  );
}
