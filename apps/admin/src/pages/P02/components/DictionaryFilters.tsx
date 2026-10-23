import { useTranslation } from "react-i18next";
import type { P02MetricCategory, P02MetricDictionary } from "@exam-prep/contract";
import { FilterChips } from "@exam-prep/ui";
import type { CategoryFilter } from "../data.ts";

interface DictionaryFiltersProps {
  readonly data: P02MetricDictionary | undefined;
  readonly category: CategoryFilter;
  readonly keyword: string;
  readonly onCategory: (category: CategoryFilter) => void;
  readonly onKeyword: (keyword: string) => void;
}

const CATEGORIES: readonly P02MetricCategory[] = ["learning", "conversion", "retention", "quality", "cost"];

/** 分类与搜索始终保持挂载；加载时不展示上一查询的计数。 */
export function DictionaryFilters({ data, category, keyword, onCategory, onKeyword }: DictionaryFiltersProps) {
  const { t } = useTranslation("P02");
  const options = [
    { value: "all" as const, label: t("filters.all"), count: data?.total_count },
    ...CATEGORIES.map((category) => ({
      value: category,
      label: t(`categories.${category}`),
      count: data?.categories.find((entry) => entry.category === category)?.count,
    })),
  ];
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line-soft bg-bg-surface p-3">
      <FilterChips
        label={t("filters.label")}
        multiple={false}
        options={options}
        selected={[category]}
        onChange={(next: CategoryFilter[]) => onCategory(next[0] ?? "all")}
      />
      <label className="flex flex-col gap-1 text-small">
        {t("filters.search")}
        <input
          type="search"
          className="rounded-sm border border-line-strong bg-bg-surface p-2"
          placeholder={t("filters.placeholder")}
          value={keyword}
          onChange={(event) => onKeyword(event.target.value)}
        />
      </label>
    </div>
  );
}
