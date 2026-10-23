import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { formatDays } from "@exam-prep/shared/format";
import { Button, ContainerScope, Dialog, PageHeader, PageState, Skeleton, Tabs, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { Sandbox } from "./components/Sandbox.tsx";
import { Timeline } from "./components/Timeline.tsx";
import { readView, usePlanOverview, type PlanView } from "./data.ts";
import { PlanViews } from "./views/PlanViews.tsx";
import "./plan.css";

const MAIN_VIEWS = ["week", "scope", "ranking", "log", "calendar"] as const;
export default function Page() {
  const { t } = useTranslation("S07");
  const toast = useToast();
  const [search, setSearch] = useSearchParams();
  const view = readView(search.get("view"));
  const home = usePlanOverview();
  const data = home.data;
  const [panel, setPanel] = useState<"sandbox" | "leave" | null>(null);
  const [menu, setMenu] = useState(false);
  const [leaveNotice, setLeaveNotice] = useState(false);
  const soon = () => toast(t("soon"));
  const selectView = (next: PlanView) =>
    setSearch((previous) => {
      const result = new URLSearchParams(previous);
      result.set("view", next);
      return result;
    });
  const offline = home.offline;
  const switchRounds = () => selectView("rounds");
  return (
    <ContainerScope className="s07-page mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("header.title")}
        description={t("header.description")}
        meta={
          data === undefined ? undefined : (
            <div className="flex flex-wrap gap-2">
              <Tag>{t("header.exam", { name: data.exam_name })}</Tag>
              {data.data_source === "sample" && <Tag>{t("header.sample")}</Tag>}
            </div>
          )
        }
        actions={
          <>
            <Button
              onClick={() => {
                setLeaveNotice(false);
                setPanel("leave");
              }}
              disabled={offline || data === undefined || !data.has_plan}
            >
              {t("header.leave")}
            </Button>
            <Button variant="primary" onClick={() => setPanel("sandbox")} disabled={offline || data === undefined || !data.has_plan}>
              {t("header.sandbox")}
            </Button>
            <div className="relative">
              <Button aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
                {t("header.more")}
              </Button>
              {menu && (
                <div role="menu" aria-label={t("header.more")} className="s07-menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      soon();
                    }}
                  >
                    {t("header.sync")}
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />
      {home.state === "loading" && (
        <PageState
          state="loading"
          pageName={t("header.title")}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={
            <div aria-label={t("loading")} className="flex flex-col gap-4">
              <Skeleton title block />
              <Skeleton title block />
              <Skeleton title block />
            </div>
          }
        />
      )}
      {home.state === "error" && (
        <PageState
          state="error"
          pageName={t("header.title")}
          title={t("state.error.title")}
          body={t("state.error.body")}
          onRetry={home.retry}
          onReport={soon}
        />
      )}
      {offline && (
        <PageState
          state="offline"
          pageName={t("header.title")}
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={home.retry}>{t("state.offline.retry")}</Button>}
        />
      )}
      {home.state === "restricted" && (
        <PageState
          state="restricted"
          title={t("state.restricted.title")}
          body={t("state.restricted.body")}
          action={<Button onClick={soon}>{t("state.restricted.action")}</Button>}
        />
      )}
      {home.state === "empty" && (
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={
            <Link to={pathTo("S05")} className={buttonClass("primary")}>
              {t("state.empty.action")}
            </Link>
          }
        />
      )}
      {data !== undefined && data.has_plan && (
        <>
          <Timeline data={data} onRounds={switchRounds} />
          {data.institution_locked && (
            <PageState
              state="restricted"
              title={t("state.restricted.title")}
              body={t("state.restricted.body")}
              action={<Button onClick={soon}>{t("state.restricted.action")}</Button>}
            />
          )}
          {/* feat:S07-17 健康度不足观察窗时只标注口径：正文交给公共 PageState（它本身就是一个 <p>），
              实测天数走它现成的「原始计数」，还差什么走 missing，不在本页再套一层段落。
              观察窗周数暂无登记参数，按红线 2 不写死数字，见交接单「风险与提醒」。 */}
          {data.health_estimated && (
            <PageState
              state="insufficient_data"
              title={t("state.insufficient_data.title")}
              body={t("state.insufficient_data.body")}
              counts={[
                {
                  key: "observed_days",
                  label: t("state.insufficient_data.observed"),
                  value: formatDays(data.observed_days),
                },
              ]}
              missing={t("state.insufficient_data.missing")}
              action={
                <Link to={pathTo("S06")} className={buttonClass("secondary")}>
                  {t("state.insufficient_data.action")}
                </Link>
              }
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => selectView("week")}>
              {t("tabs.back")}
            </Button>
            <Button size="sm" onClick={switchRounds}>
              {t("tabs.rounds")}
            </Button>
            <Button size="sm" onClick={() => selectView("today")}>
              {t("header.today")}
            </Button>
          </div>
          {MAIN_VIEWS.some((item) => item === view) || view === "sandbox" ? (
            <Tabs
              label={t("tabs.label")}
              items={MAIN_VIEWS.map((key) => ({ key, label: t(`tabs.${key}`) }))}
              value={view === "sandbox" ? "week" : (view as (typeof MAIN_VIEWS)[number])}
              onChange={selectView}
            >
              <PlanViews view={view} data={data} soon={soon} offline={offline} />
            </Tabs>
          ) : (
            <PlanViews view={view} data={data} soon={soon} offline={offline} />
          )}
          <Sandbox
            key={data.plan.exam_id}
            data={data}
            open={!offline && (panel === "sandbox" || view === "sandbox")}
            onClose={() => {
              setPanel(null);
              if (view === "sandbox") selectView("week");
            }}
          />
        </>
      )}
      {/* feat:S07-09 请假先提议，尚未接入后端时不修改已有安排。 */}
      <Dialog
        open={panel === "leave"}
        onClose={() => {
          setLeaveNotice(false);
          setPanel(null);
        }}
        title={t("leave.title")}
        description={t("leave.body")}
        actions={
          <Button variant="primary" onClick={() => setLeaveNotice(true)}>
            {t("leave.preview")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {leaveNotice && (
            <p role="status" className="text-small text-ink-secondary">
              {t("soon")}
            </p>
          )}
          <label className="s07-field">
            {t("leave.start")}
            <input type="date" />
          </label>
          <label className="s07-field">
            {t("leave.end")}
            <input type="date" />
          </label>
          <label className="s07-field">
            {t("leave.reason")}
            <textarea placeholder={t("leave.placeholder")} />
          </label>
        </div>
      </Dialog>
    </ContainerScope>
  );
}
