import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S26DecisionOption } from "@exam-prep/contract";
import { param } from "@exam-prep/params";
import { formatDate } from "@exam-prep/shared/format";
import {
  Banner,
  Button,
  Card,
  Columns,
  ContainerScope,
  DataTable,
  Dialog,
  KeyValueList,
  PageHeader,
  PageState,
  Tag,
  buttonClass,
  type TableColumn,
} from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { useDecision } from "./data.ts";

export default function Page() {
  const { t } = useTranslation("S26");
  const toast = useToast();
  const result = useDecision();
  const data = result.data;
  const [selected, setSelected] = useState<S26DecisionOption>();
  const goal = (
    <Link to={pathTo("S02")} className={buttonClass("secondary")}>
      {t("state.empty.action")}
    </Link>
  );
  const columns: TableColumn<S26DecisionOption>[] = [
    { key: "name", header: t("name"), label: t("name"), render: (row) => <strong>{row.name}</strong> },
    { key: "category", header: t("category"), label: t("category"), render: (row) => row.category },
    { key: "region", header: t("region"), label: t("region"), render: (row) => row.region },
    { key: "requirements", header: t("requirements"), label: t("requirements"), render: (row) => row.requirements },
    {
      key: "action",
      header: t("action"),
      label: t("action"),
      render: (row) => (
        <Button size="sm" onClick={() => setSelected(row)}>
          {t("detail")}
        </Button>
      ),
    },
  ];
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={
          <>
            <Tag tone="brand">{t("extension")}</Tag>
            {data?.data_source === "sample" && <Tag tone="warning">{t("sample")}</Tag>}
          </>
        }
      />
      {/* feat:S26-02 数据年份、来源与免责常驻；示例数据不作为报名依据。 */}
      <Banner tone="warning" title={t("disclaimer")}>
        {t("demo_notice")}
      </Banner>
      {data !== undefined && (
        <div className="flex flex-wrap items-center gap-3 text-small text-ink-secondary" data-testid="s26-source">
          <span>{t("data_year", { year: data.data_year })}</span>
          <a className="text-brand-primary underline" href={data.source_url} target="_blank" rel="noreferrer">
            {t("source_name", { source: data.source_name })}
          </a>
          <span>{t("updated", { day: formatDate(data.updated_day, { year: true }) })}</span>
        </div>
      )}
      {result.stale && (
        <Banner tone="warning" title={t("state.offline.title")}>
          {t("state.offline.cached")}
        </Banner>
      )}
      {result.state === "loading" ? (
        <PageState state="loading" pageName={t("title")} slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")} />
      ) : result.state === "error" ? (
        <PageState state="error" pageName={t("title")} onRetry={result.retry} onReport={() => toast(t("soon.report"))} />
      ) : result.state === "offline" ? (
        <PageState
          state="offline"
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={result.retry}>{t("state.offline.action")}</Button>}
        />
      ) : data === undefined ? (
        <PageState state="restricted" title={t("state.restricted.title")} body={t("state.restricted.body")} action={goal} />
      ) : result.state === "empty" ? (
        <PageState state="empty" title={t("state.empty.title")} body={t("state.empty.body")} action={goal} />
      ) : (
        <Columns
          main={
            <div className="flex flex-col gap-4">
              {result.state === "restricted" && (
                <PageState state="restricted" title={t("state.restricted.title")} body={t("state.restricted.body")} action={goal} />
              )}
              {result.state === "insufficient_data" && (
                <PageState
                  state="insufficient_data"
                  title={t("state.insufficient_data.title")}
                  body={t("state.insufficient_data.body")}
                  action={goal}
                />
              )}
              {/* feat:S26-01 只有平台挂载了数据才显示选项；无数据考试显示空态。 */}
              {data.available && (
                <Card title={t("options")}>
                  <DataTable caption={t("options")} rows={data.items} columns={columns} rowKey={(row) => row.id} stackOnNarrow />
                </Card>
              )}
            </div>
          }
          aside={
            <Card
              title={t("source")}
              footer={
                <Link to={pathTo("S02")} className={buttonClass("secondary")}>
                  {t("goal")}
                </Link>
              }
            >
              <div className="flex flex-col gap-3">
                <p className="text-small text-ink-secondary">{t("disclaimer")}</p>
                <p className="text-small text-ink-secondary">{t("footer")}</p>
                <a className={buttonClass("secondary")} href={data.source_url} target="_blank" rel="noreferrer">
                  {t("open_source")}
                </a>
              </div>
            </Card>
          }
        />
      )}
      <Dialog
        open={selected !== undefined}
        onClose={() => setSelected(undefined)}
        title={t("detail_title")}
        actions={<Button onClick={() => setSelected(undefined)}>{t("close")}</Button>}
      >
        {selected !== undefined && (
          <KeyValueList
            items={[
              { key: "name", label: t("name"), value: selected.name },
              { key: "category", label: t("category"), value: selected.category },
              { key: "region", label: t("region"), value: selected.region },
              { key: "requirements", label: t("requirements"), value: selected.requirements },
              { key: "note", label: t("detail_note"), value: selected.note },
            ]}
          />
        )}
      </Dialog>
    </ContainerScope>
  );
}
