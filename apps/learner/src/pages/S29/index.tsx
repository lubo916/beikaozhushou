import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import type { GetSearchPageParams } from "@exam-prep/contract";
import { param } from "@exam-prep/params";
import { formatNumber } from "@exam-prep/shared/format";
import {
  Banner,
  Button,
  Card,
  Columns,
  ContainerScope,
  Dialog,
  FilterChips,
  PageHeader,
  PageState,
  Segmented,
  Tag,
  buttonClass,
} from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { useSearchPage } from "./data.ts";
import { QuickTables } from "./views/QuickTables.tsx";
import { ResultList } from "./views/ResultList.tsx";
import "./style.css";
import { resultPath } from "./routing.ts";

export default function Page() {
  const { t } = useTranslation("S29");
  const toast = useToast();
  const [search, setSearch] = useSearchParams();
  const view = search.get("view") ?? "results";
  const queryText = search.get("q");
  const kind = (search.get("kind") ?? "all") as NonNullable<GetSearchPageParams["kind"]>;
  const home = useSearchPage({
    ...(queryText === null ? (view === "recent" ? { q: "" } : {}) : { q: queryText }),
    kind,
    ...(search.has("table") ? { table: search.get("table") ?? "" } : {}),
  });
  const [input, setInput] = useState(queryText ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [intent, setIntent] = useState("");
  const data = home.data;
  const effectiveQuery = data?.query ?? queryText ?? "";
  useEffect(() => {
    setInput(effectiveQuery);
  }, [effectiveQuery]);
  // feat:S29-01 全局快捷键在本页注册；跨页外壳入口由整合任务统一接入。
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(values)) next.set(key, value);
    setSearch(next);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    update({ q: input.trim(), view: "results" });
  }
  function soon(action: string) {
    toast(t("soon.action", { action }));
  }
  // feat:S29-03 最近访问保留知识点与资料的直接入口。
  const recent = (
    <Card title={t("recent.title")}>
      <p className="text-ink-secondary">{t("recent.body")}</p>
      <ul className="s29-recent">
        {data?.recent.map((item) => (
          <li key={item.kind}>
            <Link to={resultPath(item)}>{item.title}</Link>
            <Tag>{t(`kind.${item.kind}`)}</Tag>
          </li>
        ))}
      </ul>
    </Card>
  );
  return (
    <ContainerScope className="s29-page mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader title={t("title")} description={t("description")} meta={<Tag>{t("sample")}</Tag>} />
      {/* feat:S29-01 统一搜索，匹配在接口层进行，界面只提交查询。 */}
      <Card>
        <form className="s29-search" role="search" onSubmit={submit}>
          <label className="s29-input">
            <span className="ui-visually-hidden">{t("search.label")}</span>
            <input
              ref={inputRef}
              type="search"
              value={input}
              placeholder={t("search.placeholder")}
              onChange={(event) => setInput(event.target.value)}
            />
          </label>
          <Button variant="primary" type="submit">
            {t("search.submit")}
          </Button>
          <Button
            onClick={() => {
              setIntent("");
              setPhotoOpen(true);
            }}
          >
            {t("search.photo")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setInput("");
              update({ q: "", view: "recent" });
            }}
          >
            {t("search.clear")}
          </Button>
        </form>
        <p className="s29-hint">{t("search.hint")}</p>
        <p className="s29-hint">{t("search.shortcut")}</p>
      </Card>
      <Segmented
        label={t("views.label")}
        value={view}
        options={["results", "recent", "quick"].map((value) => ({ value, label: t(`views.${value}`) }))}
        onChange={(value) => update({ view: value })}
      />
      {home.state === "loading" ? (
        <PageState state="loading" pageName={t("title")} slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")} />
      ) : home.state === "error" ? (
        <PageState
          state="error"
          pageName={t("title")}
          body={t("state.error.body")}
          onRetry={home.retry}
          onReport={() => toast(t("soon.feedback"))}
        />
      ) : home.state === "offline" ? (
        <PageState
          state="offline"
          pageName={t("title")}
          body={t("state.offline.body")}
          action={
            <Link className={buttonClass("secondary")} to={pathTo("S14")}>
              {t("state.offline.action")}
            </Link>
          }
        />
      ) : (
        <>
          {home.stale && (
            <Banner tone="warning" title={t("state.offline.body")} action={<Button onClick={home.retry}>{t("search.submit")}</Button>} />
          )}
          {/* 受限仅限制拍照，文本搜索与已取到的内容仍可用。 */}
          {home.state === "restricted" && (
            <PageState
              compact
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
          {home.state === "empty" && (
            <PageState
              state="empty"
              title={t("state.empty.title")}
              body={t("state.empty.body")}
              action={<Button onClick={() => inputRef.current?.focus()}>{t("state.empty.action")}</Button>}
            />
          )}
          {home.state === "insufficient_data" && (
            <PageState
              state="insufficient_data"
              title={t("state.insufficient_data.title")}
              body={t("state.insufficient_data.body")}
              action={
                <>
                  <Link className={buttonClass("primary")} to={pathTo("S28")}>
                    {t("state.insufficient_data.action")}
                  </Link>
                  <Button onClick={() => toast(t("soon.feedback"))}>{t("state.insufficient_data.feedback")}</Button>
                </>
              }
            />
          )}
          {data !== undefined &&
            (view === "quick" ? (
              <QuickTables data={data} onSelect={(table) => update({ table })} />
            ) : view === "recent" || home.state === "empty" ? (
              <Columns main={recent} aside={<QuickTables data={data} onSelect={(table) => update({ table })} />} />
            ) : (
              <Columns
                main={
                  <div className="flex flex-col gap-4">
                    <Card title={t("results.title")} meta={t("results.count", { total: formatNumber(data.result_count, 0) })}>
                      {/* feat:S29-02 分层结果由接口返回；筛选条件继续交给接口。 */}
                      <FilterChips
                        label={t("results.title")}
                        multiple={false}
                        selected={[kind]}
                        options={["all", "point", "material", "question", "note", "mistake", "tutor"].map((value) => ({
                          value,
                          label: t(`kind.${value}`),
                        }))}
                        onChange={(values) => update({ kind: values[0] ?? "all" })}
                      />
                      <ResultList groups={data.groups} onAction={soon} />
                    </Card>
                    {recent}
                  </div>
                }
                aside={<QuickTables data={data} onSelect={(table) => update({ table })} />}
              />
            ))}
        </>
      )}
      {/* feat:S29-05 拍照搜题先选用途；没有确认用途前不能继续。 */}
      <Dialog
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        title={t("photo.title")}
        description={t("photo.description")}
        actions={
          <>
            <Button onClick={() => setPhotoOpen(false)}>{t("photo.cancel")}</Button>
            <Button
              variant="primary"
              disabled={intent === "" || home.state === "restricted" || data?.photo_available === false}
              onClick={() => {
                setPhotoOpen(false);
                toast(t("soon.photo"));
              }}
            >
              {t("photo.continue")}
            </Button>
          </>
        }
      >
        <fieldset className="s29-intents">
          <legend>{t("photo.intent")}</legend>
          {["practice", "explain", "save"].map((value) => (
            <label key={value}>
              <input type="radio" name="photo-intent" value={value} checked={intent === value} onChange={() => setIntent(value)} />
              {t(`photo.${value}`)}
            </label>
          ))}
        </fieldset>
        <p className="s29-hint">{t("photo.quota")}</p>
        {home.state === "restricted" && (
          <PageState compact state="restricted" title={t("state.restricted.title")} body={t("state.restricted.body")} />
        )}
      </Dialog>
    </ContainerScope>
  );
}
