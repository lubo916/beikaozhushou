import { useTranslation } from "react-i18next";
import type { P05ExamAnalysis } from "@exam-prep/contract";
import { FilterChips } from "@exam-prep/ui";
import { SOURCES, type SourceFilter } from "../data.ts";

interface SourceFiltersProps {
  readonly data: P05ExamAnalysis | undefined;
  readonly source: SourceFilter;
  readonly onSource: (source: SourceFilter) => void;
}

/** 按真题来源筛选（feat:P05-01 的三级来源）；条数是接口给的入库数，加载时不展示上一查询的计数。 */
export function SourceFilters({ data, source, onSource }: SourceFiltersProps) {
  const { t } = useTranslation("P05");
  const options = [
    { value: "all" as const, label: t("filters.all"), count: data?.total_count },
    ...SOURCES.map((level) => ({
      value: level,
      label: t(`sources.${level}`),
      count: data?.source_counts.find((entry) => entry.source === level)?.count,
    })),
  ];
  return (
    <div className="rounded-md border border-line-soft bg-bg-surface p-3">
      <FilterChips
        label={t("filters.label")}
        multiple={false}
        options={options}
        selected={[source]}
        onChange={(next: SourceFilter[]) => onSource(next[0] ?? "all")}
      />
    </div>
  );
}
