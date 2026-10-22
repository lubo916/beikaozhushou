import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S14Notebook, S14NoteItem } from "@exam-prep/contract";
import { formatDateTime, formatNumber } from "@exam-prep/shared/format";
import { AiBadge, Button, Card, Columns, PageState, Tag, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

export function NotesView({
  data,
  selected,
  onSelect,
  onOpen,
  onConvert,
  onMap,
  onClear,
  filters,
}: {
  filters: ReactNode;
  data: S14Notebook;
  selected: string[];
  onSelect: (id: string) => void;
  onOpen: (item: S14NoteItem) => void;
  onConvert: (kind: "cards" | "questions") => void;
  onMap: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation("S14");
  return (
    <Columns
      main={
        <Card>
          {filters}
          <div className="flex flex-col gap-3">
          <p className="text-small text-ink-secondary">{t("list.intro")}</p>
          {/* feat:S14-05 多选生成预览，确认前不会入队。 */}
          {selected.length > 0 && (
            <Card tone="brand">
              <div className="flex flex-wrap items-center gap-2">
                <span>{t("list.selection", { total: formatNumber(selected.length) })}</span>
                <Button size="sm" onClick={() => onConvert("cards")}>
                  {t("actions.cards")}
                </Button>
                <Button size="sm" onClick={() => onConvert("questions")}>
                  {t("actions.questions")}
                </Button>
              </div>
            </Card>
          )}
          {data.notes.length === 0 && (
            <PageState
              state="empty"
              title={t("filter.noResults")}
              body={t("filter.noResultsBody")}
              action={<Button onClick={onClear}>{t("actions.clear")}</Button>}
            />
          )}
          {/* feat:S14-01 六种来源汇聚；feat:S14-03 五类与来源小标。 */}
          {data.notes.map((item) => (
            <article key={item.note.id} className="border-b border-line-soft pb-3 last:border-none">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-medium">{item.note.title}</h2>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Tag tone="brand" size="sm">{t(`type.${item.note.note_type}`)}</Tag>
                    <Tag size="sm">{t(`source.${item.source}`)}</Tag>
                    <Tag size="sm">{t(`author.${item.author}`)}</Tag>
                    {item.note.ai_generated && <AiBadge />}
                  </div>
                </div>
                <input type="checkbox" aria-label={t("list.select", { title:item.note.title })} checked={selected.includes(item.note.id)} onChange={() => onSelect(item.note.id)} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Link className="text-small text-brand-primary underline" to={pathTo("S10", {kpId:item.note.knowledge_point_ids[0] ?? "demo"})}>{item.point_path}</Link>
                <Link to={pathTo("S12",{docId:item.reader_id})} className="text-small text-ink-tertiary underline">{t("list.source",{source:item.source_title})}</Link>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-small text-ink-tertiary">{t("list.updated",{date:formatDateTime(item.note.updated_at,data.time_zone)})}</span>
                <Button size="sm" onClick={() => onOpen(item)}>{t("actions.open")}</Button>
              </div>
            </article>
          ))}
          </div>
        </Card>
      }
      aside={
        <div className="flex flex-col gap-4">
          {/* feat:S14-10 完整性计数和高频遗漏均由接口返回。 */}
          <Card
            title={t("integrity.title")}
            meta={t("integrity.coverage", { covered: formatNumber(data.integrity.covered), total: formatNumber(data.integrity.total) })}
          >
            <p className="mb-3 text-small text-ink-secondary">{t("integrity.body")}</p>
            <h3 className="mb-2 font-medium">{t("integrity.missing")}</h3>
            <ul className="flex flex-col gap-3">
              {data.integrity.missing.map((point, index) => (
                <li key={`${point.id}-${index}`} className="flex flex-col items-start gap-1">
                  <span>{point.title}</span>
                  {point.high_frequency && (
                    <Tag tone="warning" size="sm">
                      {t("integrity.high")}
                    </Tag>
                  )}
                  <Link to={pathTo("S10", { kpId: point.id })} className={buttonClass("ghost", "sm")}>
                    {t("integrity.write")}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          {/* feat:S14-11 章节导图与逐层遮挡回忆入口。 */}
          <Card title={t("actions.map")}>
            <p className="mb-3 text-small text-ink-secondary">{t("integrity.mapBody")}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onMap}>
                {t("actions.map")}
              </Button>
              <Link className={buttonClass("secondary", "sm")} to={pathTo("S16")}>
                {t("actions.recite")}
              </Link>
            </div>
          </Card>
        </div>
      }
    />
  );
}
