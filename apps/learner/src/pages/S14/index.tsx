import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import type { GetS14NotebookParams, S14NoteItem, S14Section } from "@exam-prep/contract";
import { param } from "@exam-prep/params";
import { markAiGenerated } from "@exam-prep/shared/format";
import {
  AiContent,
  Banner,
  Button,
  Card,
  ContainerScope,
  Dialog,
  FilterChips,
  PageHeader,
  PageState,
  Skeleton,
  Tabs,
  Tag,
  buttonClass,
} from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { EditorDialog } from "./components/EditorDialog.tsx";
import { useNotebook } from "./data.ts";
import { CompilationView } from "./views/CompilationView.tsx";
import { FavoritesView } from "./views/FavoritesView.tsx";
import { NotesView } from "./views/NotesView.tsx";

const VIEWS = ["notes", "favorites", "handbook", "paper"] as const;
type View = (typeof VIEWS)[number];
type Overlay = "new" | "edit" | "organize" | "cards" | "questions" | "export" | "map" | null;
const field = "w-full min-w-0 rounded-sm border border-line-strong bg-bg-surface px-3 py-2 text-body";

export default function Page() {
  const { t } = useTranslation("S14");
  const toast = useToast();
  const [search, setSearch] = useSearchParams();
  const raw = search.get("view");
  const view: View = VIEWS.find((key) => key === raw) ?? "notes";
  const [filters, setFilters] = useState<GetS14NotebookParams>({});
  const home = useNotebook(filters);
  const data = home.data;
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [editing, setEditing] = useState<S14NoteItem | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [paperLength, setPaperLength] = useState("compact");
  const [hidden, setHidden] = useState<string[]>([]);
  function changeView(next: View) {
    const params = new URLSearchParams(search);
    params.set("view", next);
    setSearch(params);
  }
  function filter(key: keyof GetS14NotebookParams, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value, cursor: "" }));
    setSelected([]);
  }
  function clear() {
    setFilters({});
    setSelected([]);
  }
  const close = () => setOverlay(null);
  const open = (item: S14NoteItem) => {
    setEditing(item);
    setOverlay("edit");
  };
  const selection = data?.notes.filter((item) => selected.includes(item.note.id)) ?? [];
  const conversion = selection.length > 0 ? selection : (data?.notes.slice(0, 1) ?? []);
  const sections = view === "paper" ? data?.paper.lengths.find((item) => item.id === paperLength)?.sections : data?.handbook.sections;
  function sectionText(items: S14Section[]) {
    return markAiGenerated(items.map((item) => `${item.title}\n${item.body}`).join("\n\n"), t("exportDialog.ai"));
  }
  function exportText() {
    if (!data) return "";
    if (view === "notes")
      return data.notes
        .map((item) => {
          const body = `${item.note.title}\n${item.point_path}\n${item.note.body}`;
          return item.note.ai_generated ? markAiGenerated(body, t("exportDialog.ai")) : body;
        })
        .join("\n\n");
    if (view === "favorites")
      return data.favorites
        .map((item) => {
          const body = `${item.title}\n${item.excerpt}`;
          return item.ai_generated ? markAiGenerated(body, t("exportDialog.ai")) : body;
        })
        .join("\n\n");
    if (view === "paper" && !data.paper_available) return t("compilation.templateBody");
    return sectionText(sections ?? []);
  }
  function download() {
    const text = exportText();
    if (!text) {
      toast(t("exportDialog.empty"));
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${t("exportDialog.filename")}-${t(`tabs.${view}`)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <ContainerScope className="s14-page mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        eyebrow={data?.exam_name}
        meta={
          <Tag tone="warning" size="sm">
            {t("sample")}
          </Tag>
        }
        actions={
          <>
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setOverlay("new");
              }}
            >
              {t("actions.new")}
            </Button>
            {/* feat:S14-08 整理成稿必须预览确认，不自动保存。 */}
            <Button disabled={!data?.ai_available} onClick={() => setOverlay("organize")}>
              {t("actions.organize")}
            </Button>
            {/* feat:S14-07 通用文本导出和浏览器打印，不设次数限制。 */}
            <Button disabled={!data} onClick={() => setOverlay("export")}>
              {t("actions.export")}
            </Button>
          </>
        }
      />
      {home.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("title")}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={
            <div className="flex flex-col gap-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          }
        />
      ) : home.state === "error" ? (
        <PageState
          state="error"
          pageName={t("title")}
          title={t("state.error.title")}
          body={t("state.error.body")}
          onRetry={home.retry}
          onReport={() => toast(t("errorReport"))}
        />
      ) : home.state === "offline" ? (
        <PageState
          state="offline"
          pageName={t("title")}
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={() => setOverlay("new")}>{t("actions.new")}</Button>}
        />
      ) : home.state === "restricted" ? (
        <PageState
          state="restricted"
          title={t("state.restricted.title")}
          body={t("state.restricted.body")}
          action={
            <Link to={pathTo("S31")} className={buttonClass("secondary")}>
              {t("state.restricted.action")}
            </Link>
          }
        />
      ) : (
        data && (
          <>
            {home.stale && (
              <Banner tone="warning" title={t("state.offline.body")}>
                {t("state.offline.draft")}
              </Banner>
            )}
            {!data.ai_available && (
              <PageState
                state="restricted"
                title={t("state.restricted.title")}
                body={t("state.restricted.body")}
                action={
                  <Link to={pathTo("S31")} className={buttonClass("secondary")}>
                    {t("state.restricted.action")}
                  </Link>
                }
              />
            )}
            {!data.paper_available && home.state !== "empty" && view !== "paper" && (
              <PageState
                state="insufficient_data"
                title={t("state.insufficient.title")}
                body={t("state.insufficient.body")}
                action={<Button onClick={() => changeView("paper")}>{t("compilation.template")}</Button>}
              />
            )}
            <Tabs label={t("tabsLabel")} value={view} items={VIEWS.map((key) => ({ key, label: t(`tabs.${key}`) }))} onChange={changeView}>
              {home.state === "empty" ? (
                <PageState
                  state="empty"
                  title={t("state.empty.title")}
                  body={t("state.empty.body")}
                  action={<Button onClick={() => setOverlay("new")}>{t("actions.new")}</Button>}
                />
              ) : view === "notes" ? (
                <div className="flex flex-col gap-4">
                  {/* feat:S14-06 全文和来源、类型、科目、时间筛选都传给接口。 */}
                  <NotesView
                    filters={<div className="mb-3 border-b border-line-soft pb-3">
                    <div className="grid grid-cols-1 gap-3 @min-tablet:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        {t("filter.search")}
                        <input
                          type="search"
                          className={field}
                          placeholder={t("filter.placeholder")}
                          value={filters.search ?? ""}
                          onChange={(e) => filter("search", e.target.value)}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        {t("filter.source")}
                        <select className={field} value={filters.source ?? ""} onChange={(e) => filter("source", e.target.value)}>
                          <option value="">{t("filter.all")}</option>
                          {["reading", "classroom", "practice", "dialogue", "voice", "photo"].map((source) => (
                            <option key={source} value={source}>
                              {t(`source.${source}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        {t("filter.subject")}
                        <select className={field} value={filters.subject ?? ""} onChange={(e) => filter("subject", e.target.value)}>
                          <option value="">{t("filter.all")}</option>
                          {data.subjects.map((subject) => (
                            <option key={subject} value={subject}>
                              {subject}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        {t("filter.since")}
                        <input
                          type="date"
                          className={field}
                          value={filters.period ?? ""}
                          onChange={(e) => filter("period", e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <FilterChips
                        label={t("filter.type")}
                        multiple={false}
                        selected={[filters.note_type ?? "all"]}
                        onChange={(values) => filter("note_type", values[0] === "all" ? "" : (values[0] ?? ""))}
                        options={["all", "general", "mnemonic", "definition", "key_points", "pitfall"].map((value) => ({
                          value,
                          label: value === "all" ? t("filter.all") : t(`type.${value}`),
                        }))}
                      />
                      <Button size="sm" variant="ghost" onClick={clear}>
                        {t("actions.clear")}
                      </Button>
                    </div>
                  </div>}
                    data={data}
                    selected={selected}
                    onSelect={(id) => setSelected((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]))}
                    onOpen={open}
                    onConvert={setOverlay}
                    onMap={() => setOverlay("map")}
                    onClear={clear}
                  />
                  <div className="flex flex-wrap gap-2">
                    {filters.cursor && (
                      <Button onClick={() => setFilters((previous) => ({ ...previous, cursor: "" }))}>{t("actions.previous")}</Button>
                    )}
                    {data.next_cursor && (
                      <Button
                        onClick={() => {
                          setFilters((previous) => ({ ...previous, cursor: data.next_cursor ?? "" }));
                          setSelected([]);
                        }}
                      >
                        {t("actions.more")}
                      </Button>
                    )}
                  </div>
                </div>
              ) : view === "favorites" ? (
                <FavoritesView items={data.favorites} />
              ) : (
                <CompilationView
                  key={view}
                  data={view === "paper" ? data.paper : data.handbook}
                  paper={view === "paper"}
                  available={data.paper_available}
                  length={paperLength}
                  onLength={setPaperLength}
                />
              )}
            </Tabs>
          </>
        )
      )}
      {(overlay === "new" || overlay === "edit") && (
        <EditorDialog
          key={overlay + (editing?.note.id ?? "")}
          item={overlay === "new" ? null : editing}
          point={data?.notes[0]?.point_path ?? ""}
          onClose={close}
        />
      )}
      <Dialog
        open={overlay === "organize"}
        onClose={close}
        title={t("organize.title")}
        description={t("organize.body")}
        actions={
          <>
            <Button onClick={close}>{t("actions.cancel")}</Button>
            <Button variant="primary" onClick={() => toast(t("soon"))}>
              {t("actions.confirm")}
            </Button>
          </>
        }
      >
        <AiContent note={t("organize.pending")}>
          <div className="flex flex-col gap-4">
            {data?.handbook.sections.map((section) => (
              <section key={section.id}>
                <h3 className="font-bold">{section.title}</h3>
                <p>{section.body}</p>
              </section>
            ))}
          </div>
        </AiContent>
      </Dialog>
      <Dialog
        open={overlay === "cards" || overlay === "questions"}
        onClose={close}
        title={overlay === "questions" ? t("conversion.questionTitle") : t("conversion.title")}
        description={t("conversion.body")}
        actions={
          <>
            <Button onClick={close}>{t("actions.cancel")}</Button>
            <Button variant="primary" onClick={() => toast(t("soon"))}>
              {t("actions.confirmQueue")}
            </Button>
          </>
        }
      >
        <AiContent note={t("conversion.pending")}>
          <div className="flex flex-col gap-4">
            {conversion.map((item) => (
              <Card key={item.note.id} title={item.note.title}>
                <p className="text-small text-ink-tertiary">{item.point_path}</p>
                <p className="mt-2 font-medium">{t("conversion.front")}</p>
                <p>{item.preview.front}</p>
                <p className="mt-2 font-medium">{t("conversion.back")}</p>
                <p>{item.preview.back}</p>
              </Card>
            ))}
          </div>
        </AiContent>
      </Dialog>
      <Dialog
        open={overlay === "export"}
        onClose={close}
        title={t("exportDialog.title")}
        description={t("exportDialog.body")}
        actions={
          <>
            <Button onClick={download}>{t("exportDialog.download")}</Button>
            <Button onClick={() => window.print()}>{t("actions.print")}</Button>
          </>
        }
      />
      <Dialog open={overlay === "map"} onClose={close} title={t("actions.map")} description={t("integrity.mapBody")}>
        <AiContent>
          <div className="flex flex-col gap-3">
            {data?.handbook.sections.map((section) => (
              <Card
                key={section.id}
                title={section.title}
                actions={
                  <Button
                    size="sm"
                    aria-expanded={!hidden.includes(section.id)}
                    onClick={() =>
                      setHidden((ids) => (ids.includes(section.id) ? ids.filter((id) => id !== section.id) : [...ids, section.id]))
                    }
                  >
                    {hidden.includes(section.id) ? t("integrity.show") : t("integrity.hide")}
                  </Button>
                }
              >
                {!hidden.includes(section.id) && <p>{section.body}</p>}
              </Card>
            ))}
          </div>
        </AiContent>
      </Dialog>
    </ContainerScope>
  );
}
