// 方格视图（feat:S09-01 方格全景）：着色片（feat:S09-02）、筛选片（feat:S09-03）、锁定提示（feat:S09-10）、按章分行的方格与图例。
// 筛选只让不符合的格子变淡、不挪位置；按筛选结果批量调整范围（feat:S09-15）还没有后端，点了提示“即将上线”。
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { S09MapOverview } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared/format";
import { IMPORTANCE_LEVELS, MASTERY_RANKS, masteryLabel } from "@exam-prep/shared/vocab";
import { Banner, Button, FilterChips } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { Legend, MapGrid } from "../components/cells.tsx";
import {
  COLORINGS,
  NO_FILTERS,
  OTHER_FILTERS,
  QUICK_FILTERS,
  REACH_FILTERS,
  hasFilters,
  matchesFilters,
  pick,
  replaceGroup,
  type Coloring,
  type Filters,
} from "../data.ts";

export interface GridViewProps {
  readonly data: S09MapOverview;
  readonly locked: boolean;
  readonly selectedId: string | undefined;
  readonly onSelect: (id: string) => void;
  /** 锁定提示里的“去修复”：带到地图体检。 */
  readonly onFix: () => void;
}

export function GridView({ data, locked, selectedId, onSelect, onFix }: GridViewProps) {
  const { t } = useTranslation("S09");
  const toast = useToast();
  const [coloring, setColoring] = useState<Coloring>("mastery");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [more, setMore] = useState(false);
  const active = hasFilters(filters);
  const matched = useMemo(() => {
    if (!active) return undefined;
    const ids = data.chapters.flatMap((chapter) =>
      chapter.points.filter((point) => matchesFilters(point, filters)).map((point) => point.id),
    );
    return new Set(ids);
  }, [active, data.chapters, filters]);

  return (
    <div className="s09-stack">
      <div className="s09-bar">
        <span className="s09-bar__label" aria-hidden="true">
          {t("coloring.label")}
        </span>
        <FilterChips
          label={t("coloring.label")}
          multiple={false}
          options={COLORINGS.map((key) => ({ value: key, label: t(`coloring.${key}`) }))}
          selected={[coloring]}
          onChange={(next) => {
            const value = next[0];
            if (value !== undefined) setColoring(value);
          }}
        />
      </div>
      <div className="s09-bar">
        <FilterChips
          label={t("filter.label")}
          options={QUICK_FILTERS.map((key) => ({ value: key, label: t(`filter.${key}`) }))}
          selected={pick(QUICK_FILTERS, filters.keys)}
          onChange={(next) => setFilters((prev) => replaceGroup(prev, QUICK_FILTERS, next))}
        />
        <Button variant="ghost" size="sm" aria-expanded={more} onClick={() => setMore((value) => !value)}>
          {more ? t("filter.less") : t("filter.more")}
        </Button>
      </div>
      {more && (
        <div className="s09-more">
          <FilterChips
            label={t("filter.importance")}
            options={IMPORTANCE_LEVELS.map((level) => ({ value: String(level), label: t("filter.importance_level", { level }) }))}
            selected={filters.importance.map(String)}
            onChange={(next) => setFilters((prev) => ({ ...prev, importance: next.map(Number) }))}
          />
          <FilterChips
            label={t("filter.mastery")}
            options={MASTERY_RANKS.map((rank) => ({ value: String(rank), label: masteryLabel(rank) }))}
            selected={filters.levels.map(String)}
            onChange={(next) => setFilters((prev) => ({ ...prev, levels: next.map(Number) }))}
          />
          <FilterChips
            label={t("filter.reach")}
            options={REACH_FILTERS.map((key) => ({ value: key, label: t(`filter.${key}`) }))}
            selected={pick(REACH_FILTERS, filters.keys)}
            onChange={(next) => setFilters((prev) => replaceGroup(prev, REACH_FILTERS, next))}
          />
          <FilterChips
            label={t("filter.other")}
            options={OTHER_FILTERS.map((key) => ({ value: key, label: t(`filter.${key}`) }))}
            selected={pick(OTHER_FILTERS, filters.keys)}
            onChange={(next) => setFilters((prev) => replaceGroup(prev, OTHER_FILTERS, next))}
          />
        </div>
      )}
      {matched !== undefined && (
        <div className="s09-result" aria-live="polite">
          <span>{t("filter.result", { n: formatCount(matched.size) })}</span>
          <Button size="sm" variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
            {t("filter.clear")}
          </Button>
          <Button size="sm" onClick={() => toast(t("soon.scope"))}>
            {t("filter.scope_add")}
          </Button>
          <Button size="sm" onClick={() => toast(t("soon.scope"))}>
            {t("filter.scope_remove")}
          </Button>
        </div>
      )}
      {locked && (
        <Banner
          tone="warning"
          action={
            <Button size="sm" onClick={onFix}>
              {t("grid.fix")}
            </Button>
          }
        >
          {t("grid.locked")}
        </Banner>
      )}
      <MapGrid chapters={data.chapters} coloring={coloring} locked={locked} matched={matched} selectedId={selectedId} onSelect={onSelect} />
      <Legend coloring={coloring} locked={locked} />
    </div>
  );
}
