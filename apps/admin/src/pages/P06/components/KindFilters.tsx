import { useTranslation } from "react-i18next";
import type { P06ChangeImpact } from "@exam-prep/contract";
import { FilterChips } from "@exam-prep/ui";
import { KINDS, type KindFilter } from "../data.ts";

interface KindFiltersProps {
  readonly data: P06ChangeImpact | undefined;
  readonly kind: KindFilter;
  readonly onKind: (kind: KindFilter) => void;
}

/** 按变更类型（大纲、教材、规则）筛选；条数是接口给的事件数，加载时不展示上一查询的计数。 */
export function KindFilters({ data, kind, onKind }: KindFiltersProps) {
  const { t } = useTranslation("P06");
  const options = [
    { value: "all" as const, label: t("filters.all"), count: data?.total_count },
    ...KINDS.map((value) => ({
      value,
      label: t(`kinds.${value}`),
      count: data?.kind_counts.find((entry) => entry.kind === value)?.count,
    })),
  ];
  return (
    <div className="rounded-md border border-line-soft bg-bg-surface p-3">
      <FilterChips
        label={t("filters.label")}
        multiple={false}
        options={options}
        selected={[kind]}
        onChange={(next: KindFilter[]) => onKind(next[0] ?? "all")}
      />
    </div>
  );
}
