import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatCount, formatDateTime } from "@exam-prep/shared/format";
import { Button, Card, Columns, ProgressBar, Tag } from "@exam-prep/ui";
import { Row, Rows, secondary, type ViewProps } from "../components/parts.tsx";
const KINDS = ["all", "security", "device", "import", "delete", "order"] as const;
export function AssetsView({ data, confirm, soon, exportData }: ViewProps) {
  const { t } = useTranslation("S32");
  const [filter, setFilter] = useState<string>("all");
  const date = (value: string) => formatDateTime(value, data.time_zone);
  return (
    <Columns
      main={
        <div className="flex flex-col gap-4">
          {/* feat:S32-11 任务进度与结果。 feat:S32-12 教材、题库、整个科目搬运。 feat:S32-21 失败可用原文件重试。 */}
          <Card
            title={t("assets.tasks.title")}
            actions={
              <>
                <Button size="sm" onClick={() => confirm("import")}>
                  {t("assets.tasks.import")}
                </Button>
                <Button size="sm" onClick={exportData}>
                  {t("assets.tasks.export")}
                </Button>
              </>
            }
          >
            <div className="flex flex-wrap gap-2">
              {(["textbook", "question_bank", "subject"] as const).map((kind) => (
                <Tag key={kind}>{t("assets.type." + kind)}</Tag>
              ))}
            </div>
            <Rows>
              {data.tasks.map((task) => (
                <Row key={task.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{task.title}</p>
                    <Tag>{t("assets.tasks.kind." + task.kind)}</Tag>
                    <Tag tone={task.status === "failed" ? "warning" : task.status === "completed" ? "success" : "brand"}>
                      {t("assets.tasks.status." + task.status)}
                    </Tag>
                  </div>
                  <p className={secondary}>
                    {t("assets.type." + task.asset_type)} · {date(task.created_at)}
                  </p>
                  <ProgressBar value={task.progress} label={t("assets.tasks.progress")} />
                  {task.original_file !== undefined && <p className={secondary}>{t("assets.tasks.file", { name: task.original_file })}</p>}
                  {task.status === "failed" && <p className={secondary}>{t("assets.tasks.failure")}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {task.status === "failed" ? (
                      <>
                        <Button size="sm" onClick={() => confirm("import", { name: task.title })}>
                          {t("assets.tasks.retry")}
                        </Button>
                        <Button size="sm" onClick={() => confirm("replace", { name: task.title })}>
                          {t("assets.tasks.replace")}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={soon}>
                        {t("assets.tasks.result")}
                      </Button>
                    )}
                  </div>
                </Row>
              ))}
            </Rows>
          </Card>
          {/* feat:S32-18 操作与安全事件共用时间线，类别筛选只改变显示。 */}
          <Card title={t("assets.activity.title")}>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((kind) => (
                <Button
                  key={kind}
                  size="sm"
                  variant={filter === kind ? "primary" : "secondary"}
                  aria-pressed={filter === kind}
                  onClick={() => setFilter(kind)}
                >
                  {t("assets.activity.kind." + kind)}
                </Button>
              ))}
            </div>
            <Rows>
              {data.activities
                .filter((item) => filter === "all" || item.kind === filter)
                .map((item) => (
                  <Row key={item.id} actions={<Tag>{t("assets.activity.kind." + item.kind)}</Tag>}>
                    <p>{t("assets.activity.event." + item.event)}</p>
                    <p className={secondary}>{date(item.at)}</p>
                  </Row>
                ))}
            </Rows>
          </Card>
        </div>
      }
      aside={
        <div className="flex flex-col gap-4">
          {/* feat:S32-20 分享有效期、提取码、导入上限与撤销；接收方先预览。 */}
          <Card
            title={t("assets.shares.title")}
            actions={
              <Button size="sm" onClick={soon}>
                {t("assets.shares.create")}
              </Button>
            }
          >
            <p className={secondary}>{t("assets.shares.notice")}</p>
            <Rows>
              {data.shares.map((share) => (
                <Row key={share.id}>
                  <p className="font-medium">{share.title}</p>
                  <p className={secondary}>{t("assets.shares.expires", { date: date(share.expires_at) })}</p>
                  <p className={secondary}>{t("assets.shares.code", { code: share.code })}</p>
                  <p className={secondary}>
                    {t("assets.shares.usage", { used: formatCount(share.import_count), limit: formatCount(share.import_limit) })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => confirm("import", { name: share.title })}>
                      {t("assets.shares.preview")}
                    </Button>
                    <Button size="sm" disabled={!share.active} onClick={() => confirm("revoke")}>
                      {t("assets.shares.revoke")}
                    </Button>
                  </div>
                </Row>
              ))}
            </Rows>
          </Card>
          {/* feat:S32-15 保留期内恢复、到期提醒。 feat:S32-16 覆盖/批删/永久删除先说明后果，再确认。 */}
          <Card
            title={t("assets.recycle.title")}
            actions={
              <Button size="sm" disabled={data.recycle.length === 0} onClick={() => confirm("bulk")}>
                {t("assets.recycle.bulk")}
              </Button>
            }
          >
            <p className={secondary}>{t("assets.recycle.notice", { days: formatCount(data.recycle_days) })}</p>
            <Rows>
              {data.recycle.map((item) => (
                <Row key={item.id}>
                  <p className="font-medium">{item.title}</p>
                  <p className={secondary}>
                    {t("assets.type." + item.kind)} · {t("assets.recycle.expires", { date: date(item.expires_at) })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => confirm("restore", { name: item.title })}>
                      {t("assets.recycle.restore")}
                    </Button>
                    <Button size="sm" onClick={() => confirm("delete", { name: item.title })}>
                      {t("assets.recycle.delete")}
                    </Button>
                  </div>
                </Row>
              ))}
            </Rows>
          </Card>
        </div>
      }
    />
  );
}
