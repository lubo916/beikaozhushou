import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { Banner, Button, Card, ContainerScope, Dialog, PageHeader, PageState, Skeleton, Tabs, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { MaterialSetup } from "./views/MaterialSetup.tsx";
import { TimeSetup } from "./views/TimeSetup.tsx";
import { useSetupProfile } from "./data.ts";

function readOfflineDraft(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

export default function Page() {
  const { t } = useTranslation("S03");
  const toast = useToast();
  const [search, setSearch] = useSearchParams();
  const view = search.get("view") === "res" ? "res" : "time";
  const home = useSetupProfile();
  const data = home.data;
  const offline = home.state === "offline" || home.stale;
  const draftKey = `S03.offline-draft.${search.get("exam") ?? "default"}`;
  const [dailyDrafts, setDailyDrafts] = useState<Record<string, string>>({});
  const [daily, setDaily] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [skip, setSkip] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const selectView = (value: string) =>
    setSearch((old) => {
      const next = new URLSearchParams(old);
      next.set("view", value);
      return next;
    });
  const showDaily = () => {
    setMinutes(dailyDrafts[draftKey] ?? (offline ? readOfflineDraft(draftKey) : undefined) ?? String(data?.daily_minutes ?? ""));
    setDaily(true);
  };
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <header>
        <PageHeader
          title={t(view === "time" ? "time.title" : "res.title")}
          eyebrow={t("title")}
          meta={<Tag tone="warning">{t("sample")}</Tag>}
        />
      </header>
      <p className="text-ink-secondary">{t(view === "time" ? "time.description" : "res.description")}</p>
      {/* feat:S03-11 时间与资料拆成两屏，开发 query 切换保留其他参数。 */}
      <Tabs
        label={t("view.label")}
        value={view}
        items={[
          { key: "time", label: t("view.time") },
          { key: "res", label: t("view.res") },
        ]}
        onChange={selectView}
      />
      {skipped && <Banner tone="warning">{t("skip.notice")}</Banner>}
      {home.stale && <Banner tone="warning">{t("state.offline.body")}</Banner>}
      {home.state === "loading" && (
        <PageState
          state="loading"
          pageName={t("title")}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={
            <>
              <Skeleton title lines={3} block />
              <Skeleton lines={4} block />
            </>
          }
        />
      )}
      {home.state === "error" && (
        <PageState
          state="error"
          pageName={t("title")}
          body={t("state.error.body")}
          onRetry={home.retry}
          onReport={() => toast(t("soon.report"))}
        />
      )}
      {home.state === "offline" && (
        <>
          <PageState state="offline" title={t("state.offline.title")} body={t("state.offline.body")} />
          <Card title={t("time.offline_draft")}>
            <Button onClick={showDaily}>{t("time.daily")}</Button>
          </Card>
        </>
      )}
      {home.state === "empty" && (
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={
            <Button variant="primary" onClick={showDaily}>
              {t("state.empty.action")}
            </Button>
          }
        />
      )}
      {home.state === "restricted" && (
        <PageState
          state="restricted"
          title={t("state.restricted.title")}
          body={t("state.restricted.body")}
          action={
            <Link to={pathTo("S11")} className={buttonClass("secondary")}>
              {t("state.restricted.action")}
            </Link>
          }
        />
      )}
      {home.state === "insufficient_data" && (
        <PageState
          state="insufficient_data"
          title={t("state.insufficient_data.title")}
          body={t("state.insufficient_data.parameter_body", { days: data?.summary.calibration_days })}
        />
      )}
      {data !== undefined && home.state !== "empty" && (
        <>
          <div hidden={view !== "time"}>
            <TimeSetup key={data.exam_name} data={data} onDaily={showDaily} />
          </div>
          <div hidden={view !== "res"}>
            <MaterialSetup key={data.exam_name} data={data} />
          </div>
        </>
      )}
      {/* feat:S03-08 跳过时明确说明使用典型值，实际档案写入留给后端。 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
        {view === "time" ? (
          <Link to={pathTo("S02")} className={buttonClass("secondary")}>
            {t("action.back")}
          </Link>
        ) : (
          <Button onClick={() => selectView("time")}>{t("action.back")}</Button>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setSkip(true)}>
            {t("action.skip")}
          </Button>
          {view === "time" ? (
            <Button variant="primary" onClick={() => selectView("res")}>
              {t("action.next")}
            </Button>
          ) : (
            <Link to={pathTo("S04")} className={buttonClass("primary")}>
              {t("action.diagnosis")}
            </Link>
          )}
        </div>
      </div>
      {/* feat:S03-03 每日目标时长是兜底输入，不在组件里推算周总量。 */}
      <Dialog
        open={daily}
        onClose={() => setDaily(false)}
        title={t("time.daily")}
        description={t("time.daily_hint")}
        actions={
          <>
            <Button onClick={() => setDaily(false)}>{t("action.cancel")}</Button>
            <Button
              variant="primary"
              disabled={minutes === "" || !Number.isFinite(Number(minutes)) || Number(minutes) < 0}
              onClick={() => {
                setDailyDrafts((old) => ({ ...old, [draftKey]: minutes }));
                if (offline) {
                  try {
                    localStorage.setItem(draftKey, minutes);
                    toast(t("time.saved"));
                  } catch {
                    toast(t("soon.save"));
                  }
                } else toast(t("soon.save"));
                setDaily(false);
              }}
            >
              {t(offline ? "time.offline_save" : "action.save")}
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-2">
          {t("time.daily_label")}
          <input
            className="w-full rounded-sm border border-line-strong bg-surface px-3 py-2"
            type="number"
            min="0"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>
      </Dialog>
      <Dialog
        open={skip}
        onClose={() => setSkip(false)}
        title={t("skip.title")}
        description={t("skip.body")}
        actions={
          <>
            <Button onClick={() => setSkip(false)}>{t("action.cancel")}</Button>
            {view === "res" ? (
              <Link to={pathTo("S04")} className={buttonClass("primary")}>
                {t("action.continue")}
              </Link>
            ) : (
              <Button
                variant="primary"
                onClick={() => {
                  setSkip(false);
                  setSkipped(true);
                  selectView("res");
                }}
              >
                {t("action.continue")}
              </Button>
            )}
          </>
        }
      />
    </ContainerScope>
  );
}
