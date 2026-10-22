import { useState } from "react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { S19MistakeRow, S19Notebook } from "@exam-prep/contract";
import { formatDate, formatNumber } from "@exam-prep/shared/format";
import { Button, Card, Columns, PageState, Segmented, Tag } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { MistakeDetail } from "../components/MistakeDetail.tsx";

type Filters = Record<"subject" | "point" | "cause" | "source" | "status" | "time", string>;
const INITIAL: Filters = { subject: "", point: "", cause: "", source: "", status: "", time: "" };

export function NotebookList({ data, todayOnly, onAnalyze }: { data: S19Notebook; todayOnly: boolean; onAnalyze: () => void }) {
  const { t } = useTranslation("S19");
  const toast = useToast();
  const [search, setSearch] = useSearchParams();
  const [stubbornOnly, setStubbornOnly] = useState(false);
  const trapFilter = search.get("trap") ?? "";
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [grouping, setGrouping] = useState("question");
  const [selected, setSelected] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();
  const clearTrap = () => {
    const next = new URLSearchParams(search);
    next.delete("trap");
    setSearch(next, { replace: true });
    setSelected([]);
  };
  const resetFilters = () => {
    setFilters(INITIAL);
    setStubbornOnly(false);
    setActiveId(undefined);
    clearTrap();
  };
  // feat:S19-07 六维筛选只决定展示哪些行，不计算掌握档、排程或统计数字。
  const rows = data.items.filter(
    (row) =>
      (!todayOnly || row.due_today) &&
      (!stubbornOnly || row.mistake.tags.includes("stubborn")) &&
      (!trapFilter || row.trap_code === trapFilter) &&
      (!filters.subject || row.subject === filters.subject) &&
      (!filters.point || row.point_name === filters.point) &&
      (!filters.cause || row.cause_code === filters.cause) &&
      (!filters.source || row.source === filters.source) &&
      (!filters.status || row.mistake.status === filters.status) &&
      (!filters.time || row.due_today),
  );
  const active = rows.find((row) => row.mistake.id === activeId) ?? rows[0];
  const values = (key: keyof Filters) => {
    if (key === "time") return [{ value: "today", label: t("filters.today") }];
    const list = data.items.map((row) =>
      key === "subject"
        ? row.subject
        : key === "point"
          ? row.point_name
          : key === "cause"
            ? row.cause_code
            : key === "source"
              ? row.source
              : row.mistake.status,
    );
    return [...new Set(list)].map((value) => ({
      value,
      label: key === "cause" || key === "source" || key === "status" ? t(`${key}.${value}`) : value,
    }));
  };
  const groups = grouping === "point" ? [...new Set(rows.map((row) => row.point_name))] : [""];
  return (
    <div className="flex flex-col gap-4">
      {!todayOnly && (
        <Card
          title={t("filters.title")}
          actions={
            <Button size="sm" onClick={resetFilters}>
              {t("actions.reset")}
            </Button>
          }
        >
          <label className="mb-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={stubbornOnly}
              onChange={(event) => {
                setStubbornOnly(event.target.checked);
                setSelected([]);
              }}
            />
            {t("filters.stubborn")}
          </label>
          {trapFilter && (
            <p className="mb-3 text-small">
              {t("filters.trap")}：{t(`trap.${trapFilter}`)}{" "}
              <Button size="sm" onClick={clearTrap}>
                {t("actions.clear_trap")}
              </Button>
            </p>
          )}
          <div className="s19-filters">
            {(Object.keys(INITIAL) as (keyof Filters)[]).map((key) => (
              <label key={key} className="s19-field">
                <span>{t(`filters.${key}`)}</span>
                <select
                  aria-label={t(`filters.${key}`)}
                  value={filters[key]}
                  onChange={(event) => {
                    setFilters({ ...filters, [key]: event.target.value });
                    setSelected([]);
                  }}
                >
                  <option value="">{t("filters.any")}</option>
                  {values(key).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </Card>
      )}
      <Columns
        main={
          <Card
            title={t(todayOnly ? "list.today_title" : "list.all_title")}
            actions={
              <Button size="sm" onClick={() => toast(t("soon"))}>
                {t("actions.manual")}
              </Button>
            }
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{t("list.selected", { total: formatNumber(selected.length, 0) })}</span>
                <Button disabled={selected.length === 0} onClick={onAnalyze}>
                  {t("actions.batch")}
                </Button>
              </div>
            }
          >
            {/* feat:S19-01 自动收录明确排除诊断；feat:S19-11 手动标记与移出 */}
            <p className="mb-3 text-small text-ink-secondary">{t("list.hint")}</p>
            <p className="mb-3 text-small text-ink-tertiary">{t("list.sample_hint")}</p>
            <Segmented
              label={t("list.view")}
              value={grouping}
              onChange={setGrouping}
              options={[
                { value: "question", label: t("list.by_question") },
                { value: "point", label: t("list.by_point") },
              ]}
              size="sm"
            />
            {rows.length === 0 ? (
              <PageState
                state="empty"
                compact
                title={t("list.no_match")}
                action={<Button onClick={resetFilters}>{t("actions.reset")}</Button>}
              />
            ) : (
              groups.map((group) => (
                <div key={group} className="mt-3">
                  {group && <h3 className="mb-2 font-bold">{group}</h3>}
                  <ul className="flex flex-col gap-3">
                    {rows
                      .filter((row) => !group || row.point_name === group)
                      .map((row) => (
                        <MistakeRow
                          key={row.mistake.id}
                          row={row}
                          active={row.mistake.id === active?.mistake.id}
                          selected={selected.includes(row.mistake.id)}
                          onSelect={() =>
                            setSelected(
                              selected.includes(row.mistake.id)
                                ? selected.filter((id) => id !== row.mistake.id)
                                : [...selected, row.mistake.id],
                            )
                          }
                          onOpen={() => setActiveId(row.mistake.id)}
                        />
                      ))}
                  </ul>
                </div>
              ))
            )}
          </Card>
        }
        aside={active && <MistakeDetail key={active.mistake.id} row={active} />}
      />
    </div>
  );
}

function MistakeRow({
  row,
  active,
  selected,
  onSelect,
  onOpen,
}: {
  row: S19MistakeRow;
  active: boolean;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation("S19");
  return (
    <li className={`s19-row ${active ? "s19-row-active" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input type="checkbox" aria-label={`${t("list.select")}：${row.stem}`} checked={selected} onChange={onSelect} />
        {/* feat:S19-03 只有四个生命周期状态；顽固只是标签。 */}
        <Tag tone={row.mistake.status === "graduated" ? "success" : row.mistake.status === "new" ? "warning" : "brand"} size="sm">
          {t(`status.${row.mistake.status}`)}
        </Tag>
        {row.mistake.tags.includes("stubborn") && (
          <Tag tone="danger" size="sm">
            {t("list.stubborn")}
          </Tag>
        )}
        <span className="text-small text-ink-tertiary">{t(`source.${row.source}`)}</span>
      </div>
      <button type="button" className="s19-stem" aria-pressed={active} onClick={onOpen}>
        {row.stem}
      </button>
      <div className="flex flex-wrap gap-2 text-small text-ink-secondary">
        <span>{row.point_name}</span>
        <span>{t(`cause.${row.cause_code}`)}</span>
        <span>{t("list.retry_count", { total: formatNumber(row.retry_count, 0) })}</span>
      </div>
      <p className="mt-2 text-small text-ink-tertiary">{t("list.next_due", { date: formatDate(row.mistake.next_due_day) })}</p>
    </li>
  );
}
