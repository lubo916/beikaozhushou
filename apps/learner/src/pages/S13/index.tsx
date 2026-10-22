import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { param } from "@exam-prep/params";
import { Banner, Button, Card, ContainerScope, DataTable, PageHeader, PageState, Skeleton, Tabs, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { useShellPage } from "../../app/page-context.tsx";
import { pathTo } from "../../routes.ts";
import { Lesson } from "./components/Lesson.tsx";
import { useClassroom } from "./data.ts";

const VIEWS = ["video", "audio", "ext"] as const;
type View = (typeof VIEWS)[number];
export default function Page() {
  const { t } = useTranslation("S13");
  const toast = useToast();
  const shell = useShellPage();
  const [query, setQuery] = useSearchParams();
  const active: View = VIEWS.find((key) => key === shell.view?.key) ?? "video";
  const home = useClassroom();
  const data = home.data;
  const [courseId, setCourseId] = useState("");
  const course = data?.courses.find((item) => item.id === courseId) ?? data?.courses[0];
  function changeView(key: View) {
    shell.setView(key);
    if (import.meta.env.DEV && query.has("view")) {
      const next = new URLSearchParams(query);
      next.set("view", key);
      setQuery(next);
    }
  }
  const header = (
    <PageHeader
      title={t("title")}
      eyebrow={data?.exam_title}
      description={t("subtitle")}
      actions={
        <div className="flex flex-wrap gap-2">
          <Tag>{t("simple")}</Tag>
          {data?.data_source === "sample" && <Tag>{t("sample")}</Tag>}
        </div>
      }
    />
  );
  let body;
  if (home.state === "loading")
    body = (
      <PageState
        state="loading"
        pageName={t("title")}
        slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        }
      />
    );
  else if (home.state === "offline")
    body = (
      <PageState
        state="offline"
        title={t("state.offline.title")}
        body={
          <>
            <p>{t("state.offline.body")}</p>
            <p>{t("state.offline.note")}</p>
          </>
        }
        action={<Button onClick={home.retry}>{t("state.offline.action")}</Button>}
      />
    );
  else if (home.state === "restricted")
    body = (
      <PageState
        state="restricted"
        title={t("state.restricted.title")}
        body={t("state.restricted.body")}
        action={
          <Link className={buttonClass("secondary")} to={pathTo("S11")}>
            {t("state.restricted.action")}
          </Link>
        }
      />
    );
  else if (home.state === "error" || data === undefined)
    body = <PageState state="error" pageName={t("title")} onRetry={home.retry} onReport={() => toast(t("soon.report"))} />;
  else if (home.state === "empty")
    body = (
      <PageState
        state="empty"
        title={t("state.empty.title")}
        body={t("state.empty.body")}
        action={
          <Link className={buttonClass("primary")} to={pathTo("S11")}>
            {t("state.empty.action")}
          </Link>
        }
      />
    );
  else
    body = (
      <>
        {home.stale && (
          <Banner tone="warning" title={t("state.offline.stale")}>
            {t("state.offline.body")}
          </Banner>
        )}
        {/* 数据不足只限制音频化，保留视频、逐字稿与外部课。 */}
        {!data.audio_available && (
          <PageState
            state="insufficient_data"
            title={t("state.insufficient_data.title")}
            body={
              <>
                <p>{t("state.insufficient_data.body")}</p>
                <p>{t("state.insufficient_data.reason")}</p>
              </>
            }
          />
        )}
        <Tabs label={t("tabs.label")} value={active} onChange={changeView} items={VIEWS.map((key) => ({ key, label: t(`tabs.${key}`) }))}>
          <div className="flex flex-col gap-4" data-testid={`S13-${active}`}>
            {active === "ext" ? (
              <>
                {/* feat:S13-07 外部课只外链；展示时段映射、进度与返回检测入口。 */}
                <Card title={t("external.title")} meta={t("external.body")}>
                  <DataTable
                    caption={t("external.title")}
                    rows={data.external_courses}
                    rowKey={(row) => row.id}
                    stackOnNarrow
                    columns={[
                      {
                        key: "course",
                        header: t("external.course"),
                        label: t("external.course"),
                        render: (row) => (
                          <div>
                            <strong>{row.title}</strong>
                            <p className="text-small text-ink-tertiary">{row.platform_name}</p>
                          </div>
                        ),
                      },
                      {
                        key: "mapping",
                        header: t("external.mapping"),
                        label: t("external.mapping"),
                        render: (row) => (
                          <div>
                            <Link className="text-brand-primary underline" to={pathTo("S10", { kpId: row.point_id })}>
                              {row.point_name}
                            </Link>
                            <p className="text-small">{row.mapped_time}</p>
                          </div>
                        ),
                      },
                      {
                        key: "progress",
                        header: t("external.progress"),
                        label: t("external.progress"),
                        render: (row) => row.progress_label,
                      },
                      {
                        key: "actions",
                        header: t("external.actions"),
                        label: t("external.actions"),
                        render: (row) => (
                          <div className="flex flex-wrap gap-2">
                            <a className={buttonClass("primary", "sm")} href={row.url} target="_blank" rel="noopener noreferrer">
                              {t("external.open")}
                            </a>
                            <Button size="sm" variant="secondary" onClick={() => toast(t("external.soon"))}>
                              {t("external.record")}
                            </Button>
                            <Link className={buttonClass("secondary", "sm")} to={pathTo("S18")}>
                              {t("external.check")}
                            </Link>
                          </div>
                        ),
                      },
                    ]}
                    empty={t("external.empty")}
                  />
                  <p className="mt-3 text-small text-ink-tertiary">{t("external.sample")}</p>
                </Card>
              </>
            ) : (
              course !== undefined && (
                <>
                  <label className="flex flex-col gap-1 text-small font-medium">
                    {t("player.source")}
                    <select
                      className="w-full rounded-sm border border-line-strong bg-bg-surface p-3 text-body"
                      value={course.id}
                      onChange={(event) => setCourseId(event.target.value)}
                    >
                      {data.courses.map((item) => (
                        <option key={item.id} value={item.id}>
                          {t(`sources.${item.source}`)} · {item.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Lesson
                    key={`${active}-${course.id}`}
                    course={course}
                    notes={data.notes}
                    audio={active === "audio"}
                    audioAvailable={data.audio_available}
                  />
                </>
              )
            )}
            <p className="text-small text-ink-tertiary">{t(`copyright.${active}`)}</p>
          </div>
        </Tabs>
      </>
    );
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      {header}
      {body}
    </ContainerScope>
  );
}
