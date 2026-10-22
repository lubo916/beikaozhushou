import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { param } from "@exam-prep/params";
import { formatCount, formatDateTime } from "@exam-prep/shared/format";
import { Button, ContainerScope, Dialog, PageHeader, PageState, Segmented, Skeleton, Tabs, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { useProgress } from "./data.ts";
import { Overview } from "./views/Overview.tsx";
import { ValueMap } from "./views/ValueMap.tsx";
import { Diagnosis } from "./views/Diagnosis.tsx";
import { Calibration } from "./views/Calibration.tsx";
const VIEWS = ["overview", "value", "diagnosis", "calibration"] as const;
type View = (typeof VIEWS)[number];
export default function Page() {
  const { t } = useTranslation("S24");
  const [search, setSearch] = useSearchParams();
  const input = search.get("view");
  const view: View = VIEWS.find((v) => v === input) ?? "overview";
  const home = useProgress();
  const data = home.data;
  const toast = useToast();
  const soon = () => toast(t("common.soon"));
  const [simulation, setSimulation] = useState(false);
  const [option, setOption] = useState("current");
  const lowConfidence = data?.forecasts.today?.low_confidence || data?.forecasts.target?.low_confidence;
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("title")}
        description={data?.exam_name ?? t("description")}
        actions={
          <>
            {/* feat:S24-09 无导出写操作权限时按样板保留反馈入口。 */}
            <Button onClick={soon}>{t("header.export")}</Button>
            <Button variant="primary" onClick={() => setSimulation(true)}>
              {t("header.simulate")}
            </Button>
          </>
        }
        meta={
          data && (
            <div className="flex flex-wrap items-center gap-2">
              <Tag>{t("header.sample")}</Tag>
              <span className="text-small text-ink-secondary">
                {t("header.updated", { time: formatDateTime(data.computed_at, data.time_zone) })}
              </span>
            </div>
          )
        }
      />
      {home.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("title")}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={<Skeleton title block />}
        />
      ) : home.state === "offline" ? (
        <PageState
          state="offline"
          title={t("state.offline.none_title")}
          body={t("state.offline.body") + " " + t("state.offline.missing")}
          action={<Button onClick={home.retry}>{t("common.retry")}</Button>}
        />
      ) : home.state === "error" || !data ? (
        <PageState state="error" pageName={t("title")} onRetry={home.retry} onReport={soon} />
      ) : home.state === "empty" ? (
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={
            <Link to={pathTo("S04")} className={buttonClass("primary")}>
              {t("state.empty.action")}
            </Link>
          }
        />
      ) : (
        <>
          {home.stale && (
            <PageState
              state="offline"
              compact
              title={t("state.offline.title")}
              body={t("state.offline.body")}
              action={<Button onClick={home.retry}>{t("common.retry")}</Button>}
            />
          )}
          {lowConfidence && (
            <PageState
              state="insufficient_data"
              compact
              title={t("state.insufficient_data.title")}
              body={t("state.insufficient_data.body")}
              counts={[{ key: "evidence", label: t("forecast.evidence_label"), value: formatCount(data.evidence_count) }]}
            />
          )}
          <Tabs
            label={t("tabs.label")}
            items={VIEWS.map((key) => ({ key, label: t("tabs." + key) }))}
            value={view}
            onChange={(key) =>
              setSearch((previous) => {
                const next = new URLSearchParams(previous);
                next.set("view", key);
                return next;
              })
            }
          >
            {view === "overview" && <Overview data={data} soon={soon} />}
            {view === "value" && <ValueMap data={data} />}
            {view === "diagnosis" && <Diagnosis data={data} soon={soon} />}
            {view === "calibration" && <Calibration data={data} soon={soon} />}
          </Tabs>
        </>
      )}
      <Dialog
        open={simulation}
        onClose={() => setSimulation(false)}
        title={t("simulation.title")}
        actions={
          <>
            <Button onClick={() => setSimulation(false)}>{t("common.close")}</Button>
            <Button variant="primary" onClick={soon}>
              {t("simulation.run")}
            </Button>
          </>
        }
      >
        <p>{t("simulation.body")}</p>
        <Segmented
          label={t("simulation.option")}
          value={option}
          onChange={setOption}
          options={["current", "more", "focus"].map((value) => ({ value, label: t("simulation." + value) }))}
        />
        <p className="text-small text-ink-secondary">{t("simulation.note")}</p>
      </Dialog>
    </ContainerScope>
  );
}
