// 开始页两张说明卡（题从哪来、规则）共用的条目列表：每条一个粗体标题加一句说明，条目之间一条细线（原型）。
import { cx } from "@exam-prep/ui";

export interface InfoRow {
  readonly key: string;
  readonly title: string;
  readonly body: string;
}

export function InfoList({ rows }: { readonly rows: readonly InfoRow[] }) {
  return (
    <ul className="flex flex-col">
      {rows.map((row, index) => (
        <li key={row.key} className={cx("flex flex-col gap-1 py-3", index > 0 && "border-t border-line-soft")}>
          <span className="font-bold text-ink-primary">{row.title}</span>
          <span className="text-small text-ink-secondary">{row.body}</span>
        </li>
      ))}
    </ul>
  );
}
