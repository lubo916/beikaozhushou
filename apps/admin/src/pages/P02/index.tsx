// P02 数据中台（平台后台简版：主视图＋七态＋P0 指标字典；暂缓的 P1 见 W01 交接单）。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { param } from "@exam-prep/params";
import { Banner, Button, Columns, ContainerScope, PageHeader, PageState, Skeleton, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { Link, useLocation } from "../../router/history.tsx";
import { pathTo } from "../../routes.ts";
import { DictionaryFilters } from "./components/DictionaryFilters.tsx";
import { DictionaryTable } from "./components/DictionaryTable.tsx";
import { QualityCard } from "./components/QualityCard.tsx";
import { useMetricDictionary, type CategoryFilter } from "./data.ts";

export default function Page() {
  const { t } = useTranslation("P02");
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const toast = useToast();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [keyword, setKeyword] = useState("");
  const dictionary = useMetricDictionary({ exam: query.get("exam") ?? "kj", state: query.get("state") ?? "normal", category, keyword });
  const data = dictionary.data;
  const clearFilters = () => {
    setCategory("all");
    setKeyword("");
    dictionary.retry();
  };
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={
          data === undefined ? undefined : (
            <span className="flex flex-wrap gap-1">
              {data.data_source === "sample" && <Tag size="sm">{t("sample")}</Tag>}
              <Tag size="sm" tone="outline">
                {t("scope", { exam: data.exam_name })}
              </Tag>
            </span>
          )
        }
      />
      {dictionary.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("title")}
          skeleton={<Columns main={<Skeleton title lines={6} />} aside={<Skeleton title lines={3} />} />}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        />
      ) : dictionary.state === "offline" ? (
        <PageState
          state="offline"
          pageName={t("title")}
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={dictionary.retry}>{t("state.offline.action")}</Button>}
        />
      ) : dictionary.state === "restricted" ? (
        <PageState
          state="restricted"
          title={t("state.restricted.title")}
          body={t("state.restricted.body")}
          action={
            <Link to={pathTo("P19")} className={buttonClass("secondary")}>
              {t("state.restricted.action")}
            </Link>
          }
        />
      ) : dictionary.state === "error" || data === undefined ? (
        <PageState
          state="error"
          pageName={t("title")}
          audience="staff"
          body={t("state.error.body")}
          onRetry={dictionary.retry}
          onReport={() => toast(t("soon"))}
        />
      ) : (
        <>
          {dictionary.stale && <Banner tone="warning" title={t("state.offline.stale")} />}
          <DictionaryFilters data={data} category={category} keyword={keyword} onCategory={setCategory} onKeyword={setKeyword} />
          {dictionary.state === "empty" ? (
            <PageState
              state="empty"
              title={t("state.empty.title")}
              body={t("state.empty.body")}
              action={
                <Button variant="primary" onClick={clearFilters}>
                  {t("state.empty.action")}
                </Button>
              }
            />
          ) : (
            <Columns main={<DictionaryTable data={data} />} aside={<QualityCard quality={data.quality} />} />
          )}
        </>
      )}
    </ContainerScope>
  );
}
