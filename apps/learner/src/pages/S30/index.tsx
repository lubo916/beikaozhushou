// S30 简版：主视图＋七态＋P0 内容治理。P1 房间与番茄钟保留入口，写操作等待后端登记。
// 受限分两种：接口拒绝（整页说明账号受限，不显示房间与专注记录）与未成年人模式（只留自习室与番茄钟）。
// 断网时只保留能离线用的番茄钟：在线房间和小组需要联网，收起并说明。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { param } from "@exam-prep/params";
import { formatCount, formatDuration } from "@exam-prep/shared/format";
import {
  Banner,
  Button,
  COPY,
  Card,
  Columns,
  ContainerScope,
  Dialog,
  PageHeader,
  PageState,
  Skeleton,
  Tag,
  buttonClass,
} from "@exam-prep/ui";
import { useToast } from "../../app/toast.tsx";
import { pathTo } from "../../routes.ts";
import { useStudyRoom } from "./data.ts";

type Reason = "spam" | "anxiety" | "harassment" | "privacy";
const REASONS: readonly Reason[] = ["spam", "anxiety", "harassment", "privacy"];

export default function Page() {
  const { t } = useTranslation("S30");
  const room = useStudyRoom();
  const toast = useToast();
  const [report, setReport] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  // 举报原因不预选：没选原因不能提交，每次打开都重新选（明确操作）。
  const [reason, setReason] = useState<Reason | null>(null);
  const openReport = (title: string) => {
    setReason(null);
    setReport(title);
  };
  const data = room.data;
  const soon = (action: string) => toast(t(`soon.${action}`));

  const header = (
    <PageHeader
      title={t("title")}
      description={t("description")}
      meta={
        <div className="flex flex-wrap gap-2">
          <Tag>{t("simple")}</Tag>
          {data?.data_source === "sample" && <Tag>{t("sample")}</Tag>}
        </div>
      }
    />
  );
  if (room.state === "loading")
    return (
      <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
        {header}
        <PageState
          state="loading"
          pageName={t("title")}
          slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")}
          skeleton={
            <div className="flex flex-col gap-4">
              <Skeleton title block />
              <Skeleton title block />
            </div>
          }
        />
      </ContainerScope>
    );
  if (room.state === "error")
    return (
      <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
        {header}
        <PageState
          state="error"
          pageName={t("title")}
          body={t("state.error.body")}
          onRetry={room.retry}
          onReport={() => soon("feedback")}
        />
      </ContainerScope>
    );
  if (room.state === "offline")
    return (
      <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
        {header}
        <PageState
          state="offline"
          pageName={t("title")}
          title={t("state.offline.title")}
          body={t("state.offline.body")}
          action={<Button onClick={() => soon("focus")}>{t("focus.offline")}</Button>}
        />
      </ContainerScope>
    );
  // 接口拒绝访问（403）：不显示房间与专注记录，只说明原因与出路（不是未成年人模式）。
  if (data === undefined)
    return (
      <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
        {header}
        <PageState
          state="restricted"
          pageName={t("title")}
          title={t("state.forbidden.title")}
          body={t("state.forbidden.body")}
          action={
            <Link to={pathTo("S33")} className={buttonClass("secondary")}>
              {t("state.forbidden.action")}
            </Link>
          }
        />
      </ContainerScope>
    );

  // feat:S30-01 举报、屏蔽与反引流/反焦虑规则。尚无写权限，确认后明确提示即将上线，不伪造保存成功。
  const governance = (
    <Card title={t("governance.title")} footer={<p className="text-small text-ink-tertiary">{t("governance.notice")}</p>}>
      <div className="flex flex-col gap-3">
        <p className="text-ink-secondary">{t("governance.intro")}</p>
        <ul className="list-disc space-y-2 pl-4 text-small text-ink-secondary">
          {(t("governance.rules", { returnObjects: true }) as string[]).map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <Button onClick={() => openReport(t("report.title"))}>{t("governance.report")}</Button>
        <Button variant="ghost" onClick={() => soon("settings")}>
          {t("governance.blocked")}
        </Button>
      </div>
    </Card>
  );

  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      {header}
      {room.stale && (
        <Banner
          tone="warning"
          title={t("state.offline.title")}
          action={
            <Button size="sm" onClick={room.retry}>
              {COPY.action.retry}
            </Button>
          }
        >
          {t("state.offline.body")}
        </Banner>
      )}
      {data.minor_mode && <PageState compact state="restricted" title={t("state.restricted.title")} body={t("state.restricted.body")} />}
      {room.state === "insufficient_data" && (
        <PageState
          compact
          state="insufficient_data"
          title={t("state.insufficient_data.title")}
          body={t("state.insufficient_data.body")}
          action={<Button onClick={() => soon("room")}>{t("state.insufficient_data.action")}</Button>}
        />
      )}
      <Columns
        main={
          <div className="flex flex-col gap-4">
            {/* feat:S30-02 简版保留自习室主体和可点入口，进入计时等待后端。 */}
            <Card title={t("room.title")} meta={t("room.description")}>
              <div className="flex flex-col gap-3">
                {room.stale && <p className="text-ink-secondary">{t("room.offline")}</p>}
                {!room.stale &&
                  data.rooms.map((item) => (
                    <Card
                      key={item.id}
                      as="article"
                      title={item.name}
                      headingLevel={3}
                      tone="sunk"
                      meta={<Tag>{t(`room.kind.${item.kind}`)}</Tag>}
                    >
                      <div className="flex flex-col gap-3">
                        <p className="text-small text-ink-secondary">
                          {t("room.people", { participants: formatCount(item.participants), capacity: formatCount(item.capacity) })}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="primary" onClick={() => soon("room")}>
                            {t("room.enter")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={t("room.report_room", { name: item.name })}
                            onClick={() => openReport(t("room.report_room", { name: item.name }))}
                          >
                            {t("room.report")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={t("room.block_room", { name: item.name })}
                            onClick={() => setBlocked(item.name)}
                          >
                            {t("room.block")}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                {room.state === "empty" && (
                  <PageState
                    state="empty"
                    title={t("state.empty.title")}
                    body={t("state.empty.body", { group_size: formatCount(data.group_size) })}
                    action={<Button onClick={() => soon("group")}>{t("state.empty.action")}</Button>}
                  />
                )}
              </div>
            </Card>
            {/* feat:S30-03 只展示接口给的时长；不把计时当作任务完成或掌握证据。 */}
            <Card title={t("focus.title")} footer={<p className="text-small text-ink-tertiary">{t("focus.note")}</p>}>
              <div className="flex flex-col gap-3">
                <p className="text-small text-ink-secondary">{t("focus.task")}</p>
                <p>{data.focus.task}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Tag>
                    {t("focus.duration")}: {formatDuration(data.focus.minutes)}
                  </Tag>
                  <span className="text-small text-ink-secondary">
                    {t("focus.today")}: {formatDuration(data.focus.today_minutes)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => soon("task")}>{t("focus.choose")}</Button>
                  <Button variant="primary" onClick={() => soon("focus")}>
                    {t("focus.start")}
                  </Button>
                </div>
              </div>
            </Card>
            {!data.minor_mode && room.state !== "empty" && !room.stale && (
              <Card title={t("group.title")}>
                <div className="flex flex-col gap-3">
                  <p className="text-ink-secondary">{t("group.description")}</p>
                  <p className="text-small text-ink-tertiary">{t("group.deferred")}</p>
                  <Button onClick={() => soon("group")}>{t("group.action")}</Button>
                </div>
              </Card>
            )}
          </div>
        }
        aside={data.minor_mode ? undefined : governance}
      />
      <Dialog
        open={report !== null}
        onClose={() => setReport(null)}
        title={report ?? t("report.title")}
        description={t("report.description")}
        closeLabel={t("report.close")}
        actions={
          <>
            <Button onClick={() => setReport(null)}>{t("report.cancel")}</Button>
            <Button
              variant="primary"
              disabled={reason === null}
              onClick={() => {
                setReport(null);
                soon("report");
              }}
            >
              {t("report.submit")}
            </Button>
          </>
        }
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-medium">{t("report.label")}</legend>
          {REASONS.map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input type="radio" name="s30-report-reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
              <span>{t(`report.reasons.${value}`)}</span>
            </label>
          ))}
        </fieldset>
      </Dialog>
      <Dialog
        role="alertdialog"
        open={blocked !== null}
        onClose={() => setBlocked(null)}
        title={t("block.title")}
        description={t("block.description")}
        closeLabel={t("report.close")}
        actions={
          <>
            <Button onClick={() => setBlocked(null)}>{t("block.cancel")}</Button>
            <Button
              variant="danger"
              onClick={() => {
                setBlocked(null);
                soon("block");
              }}
            >
              {t("block.submit")}
            </Button>
          </>
        }
      >
        <p>{blocked}</p>
      </Dialog>
    </ContainerScope>
  );
}
