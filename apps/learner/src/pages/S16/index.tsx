// S16 简版仅主视图（默认与 ?view=main 相同）；P1 留待对应后端任务补齐。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { param } from "@exam-prep/params";
import type { S16Method, S16Training } from "@exam-prep/contract";
import { Banner, Button, Card, Columns, ContainerScope, PageHeader, PageState, Skeleton, Tabs, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { LastResult } from "./components/LastResult.tsx";
import { MatchSettings, TrainingWorkspace } from "./components/TrainingWorkspace.tsx";
import { useRecitationTraining } from "./data.ts";

const METHODS: readonly S16Method[] = ["cloze", "points", "oral", "segments"];

export default function Page() {
  const { t } = useTranslation("S16");
  const toast = useToast();
  const home = useRecitationTraining();
  const data = home.data;
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={<Button onClick={() => toast(t("soon.morning"))}>{t("morning")}</Button>}
        meta={
          data?.data_source === "sample" ? (
            <Tag tone="warning" size="sm">
              {t("sample")}
            </Tag>
          ) : undefined
        }
      />
      {home.state === "loading" ? (
        <PageState
          state="loading"
          pageName={t("title")}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={<Columns main={<Skeleton title block lines={4} />} aside={<Skeleton title block lines={3} />} />}
        />
      ) : home.state === "offline" ? (
        <PageState
          state="offline"
          title={t("state.offline.title")}
          body={
            <>
              {t("state.offline.body")}
              <p>{t("state.offline.uncached")}</p>
            </>
          }
          action={<Button onClick={home.retry}>{t("state.offline.retry")}</Button>}
        />
      ) : home.state === "restricted" && data === undefined ? (
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
      ) : home.state === "error" || data === undefined ? (
        <PageState
          state="error"
          pageName={t("title")}
          title={t("state.error.title")}
          body={t("state.error.body")}
          onRetry={home.retry}
          onReport={() => toast(t("soon.report"))}
        />
      ) : home.state === "empty" ? (
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={
            <Link to={pathTo("S12")} className={buttonClass("primary")}>
              {t("state.empty.action")}
            </Link>
          }
        />
      ) : (
        <>
          {home.stale && (
            <Banner tone="warning" title={t("state.offline.stale")}>
              {t("state.offline.body")}
            </Banner>
          )}
          <Training key={data.exam_id} data={data} offline={home.stale} />
        </>
      )}
    </ContainerScope>
  );
}

function Training({ data, offline }: { data: S16Training; offline: boolean }) {
  const { t } = useTranslation("S16");
  const toast = useToast();
  const [method, setMethod] = useState<S16Method>(data.default_method);
  const item = data.items[0];
  if (item === undefined) return null;
  return (
    <Tabs label={t("methodLabel")} value={method} onChange={setMethod} items={METHODS.map((key) => ({ key, label: t(`method.${key}`) }))}>
      <Columns
        main={
          <div className="flex flex-col gap-4">
            <TrainingWorkspace key={method} data={data} item={item} method={method} offline={offline} />
            {/* feat:S16-07 接入统一调度的入口，后端接通前不声称已安排。 */}
            <Card title={t("queueTitle")} actions={<Button onClick={() => toast(t("soon.queue"))}>{t("queue")}</Button>}>
              <p className="text-small text-ink-secondary">{t("queueHint")}</p>
            </Card>
          </div>
        }
        aside={
          <div className="flex flex-col gap-4">
            <LastResult data={data} />
            <MatchSettings data={data} />
            {/* feat:S16-08 默认不保存录音；当前简版不触发麦克风权限。 */}
            <Card title={t("privacy.title")}>
              <p className="mb-3 text-small text-ink-secondary">{t("privacy.body")}</p>
              <Link to={pathTo("S32")} className={buttonClass("ghost", "sm")}>
                {t("privacy.link")}
              </Link>
            </Card>
          </div>
        }
      />
    </Tabs>
  );
}
