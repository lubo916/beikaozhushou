import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S11Alignment, S11Workspace } from "@exam-prep/contract";
import { formatCount, formatNumber, formatPercent } from "@exam-prep/shared/format";
import { AiBadge, Banner, Button, Card, DataTable, Dialog, List, ListRow, Stat, StatGroup, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

export function PendingView({ data }: { data: S11Workspace }) {
  const { t } = useTranslation("S11");
  const toast = useToast();
  const soon = () => toast(t("soon"));
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<S11Alignment>();
  const [pointName, setPointName] = useState("");
  const [relation, setRelation] = useState("explanation");
  // feat:S11-06 每段展示知识点、关联类型、置信度、价值分和低价值不挂接。
  // feat:S11-07 支持批量/逐条审核、修改知识点与类型、拒绝与接受高置信入口。
  return (
    <Card
      title={t("views.pending")}
      meta={<AiBadge />}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button onClick={soon}>{t("actions.accept_high")}</Button>
          <Button disabled={selected.length === 0} onClick={soon}>
            {t("actions.accept_selected")}
          </Button>
        </div>
      }
      footer={t("pending.suggestion")}
    >
      <p className="mb-3 text-small text-ink-secondary">{t("pending.description")}</p>
      <DataTable<S11Alignment>
        caption={t("views.pending")}
        rows={data.alignments}
        rowKey={(row) => row.id}
        stackOnNarrow
        empty={t("pending.empty")}
        columns={[
          {
            key: "select",
            header: t("actions.accept_selected"),
            label: t("actions.accept_selected"),
            render: (row) => (
              <input
                type="checkbox"
                aria-label={t("pending.select", { segment: row.segment })}
                checked={selected.includes(row.id)}
                disabled={row.disposition !== "pending"}
                onChange={(event) =>
                  setSelected((before) => (event.target.checked ? [...before, row.id] : before.filter((id) => id !== row.id)))
                }
              />
            ),
          },
          { key: "segment", header: t("pending.segment"), label: t("pending.segment"), render: (row) => <span>{row.segment}</span> },
          {
            key: "point",
            header: t("pending.point"),
            label: t("pending.point"),
            render: (row) => (
              <Link className="text-brand-primary underline" to={pathTo("S10", { kpId: row.point_id })}>
                {row.point_name}
              </Link>
            ),
          },
          { key: "relation", header: t("pending.relation"), label: t("pending.relation"), render: (row) => t(`relation.${row.relation}`) },
          {
            key: "confidence",
            header: t("pending.confidence"),
            label: t("pending.confidence"),
            render: (row) => formatPercent(row.confidence),
          },
          { key: "value", header: t("pending.value"), label: t("pending.value"), render: (row) => formatNumber(row.value_score) },
          {
            key: "status",
            header: t("pending.disposition"),
            label: t("pending.disposition"),
            render: (row) => (
              <Tag tone={row.disposition === "accepted" ? "success" : row.disposition === "pending" ? "warning" : "outline"}>
                {t(`disposition.${row.disposition}`)}
              </Tag>
            ),
          },
          {
            key: "action",
            header: t("materials.action"),
            label: t("materials.action"),
            render: (row) =>
              row.disposition === "pending" ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={soon}>
                    {t("actions.confirm")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(row);
                      setPointName(row.point_name);
                      setRelation(row.relation);
                    }}
                  >
                    {t("actions.edit")}
                  </Button>
                  <Button size="sm" onClick={soon}>
                    {t("actions.reject")}
                  </Button>
                </div>
              ) : null,
          },
        ]}
      />
      <Dialog
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={t("actions.edit")}
        actions={
          <Button variant="primary" onClick={soon}>
            {t("actions.confirm")}
          </Button>
        }
      >
        <label className="flex flex-col gap-2">
          {t("pending.point_edit")}
          <input
            className="w-full rounded-sm border border-line-strong p-2"
            value={pointName}
            onChange={(event) => setPointName(event.target.value)}
          />
        </label>
        <label className="mt-3 flex flex-col gap-2">
          {t("pending.relation_edit")}
          <select
            className="w-full rounded-sm border border-line-strong p-2"
            value={relation}
            onChange={(event) => setRelation(event.target.value)}
          >
            {["explanation", "example", "exercise"].map((key) => (
              <option key={key} value={key}>
                {t(`relation.${key}`)}
              </option>
            ))}
          </select>
        </label>
      </Dialog>
    </Card>
  );
}

export function HealthView({ data }: { data: S11Workspace }) {
  const { t } = useTranslation("S11");
  const toast = useToast();
  // feat:S11-15 覆盖缺口、重复和新版差异；feat:S11-16 主资料建议由接口返回。
  return (
    <Card
      title={t("views.health")}
      footer={
        <Link to={pathTo("S09")} className={buttonClass("secondary")}>
          {t("health.map")}
        </Link>
      }
    >
      <p className="mb-3 text-small text-ink-secondary">{t("health.description")}</p>
      <List>
        {data.health.map((item) => (
          <ListRow
            key={item.id}
            title={t(`health.${item.kind}`)}
            description={item.detail}
            trailing={
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={item.kind === "primary" ? "brand" : "warning"}>{t("health.count", { value: formatCount(item.count) })}</Tag>
                <Button size="sm" onClick={() => toast(t("soon"))}>
                  {t("actions.open")}
                </Button>
              </div>
            }
          />
        ))}
      </List>
    </Card>
  );
}

export function InboxView({ data }: { data: S11Workspace }) {
  const { t } = useTranslation("S11");
  const toast = useToast();
  const [capture, setCapture] = useState(false);
  const [text, setText] = useState("");
  // feat:S11-17 学习收件箱：AI 预处理给建议，确认后才归档。
  return (
    <Card title={t("views.inbox")} actions={<Button onClick={() => setCapture(true)}>{t("actions.capture")}</Button>}>
      <p className="mb-3 text-small text-ink-secondary">{t("inbox.description")}</p>
      <List>
        {data.inbox.map((item) => (
          <ListRow
            key={item.id}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {item.title}
                {item.ai_generated && <AiBadge />}
              </span>
            }
            description={
              <>
                {t("inbox.suggestion")}：{item.suggestion}
              </>
            }
            trailing={
              <Button size="sm" onClick={() => toast(t("soon"))}>
                {t("inbox.accept")}
              </Button>
            }
          />
        ))}
      </List>
      <Dialog
        open={capture}
        onClose={() => setCapture(false)}
        title={t("inbox.capture_title")}
        actions={
          <Button variant="primary" disabled={text.trim() === ""} onClick={() => toast(t("soon"))}>
            {t("inbox.capture_confirm")}
          </Button>
        }
      >
        <label className="flex flex-col gap-2">
          {t("inbox.capture_label")}
          <textarea
            className="w-full rounded-sm border border-line-strong p-2"
            value={text}
            placeholder={t("inbox.capture_placeholder")}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
      </Dialog>
    </Card>
  );
}

export function TemplatesView({ data }: { data: S11Workspace }) {
  const { t } = useTranslation("S11");
  const toast = useToast();
  const soon = () => toast(t("soon"));
  const [publish, setPublish] = useState(false);
  // feat:S11-18 模板发布、内容选项、版本与举报。
  // feat:S11-19 作者计数；feat:S11-20 激励口径；feat:S11-22 原创核验后申请收益。
  return (
    <div className="flex flex-col gap-4">
      <Card title={t("views.templates")} actions={<Button onClick={() => setPublish(true)}>{t("actions.publish")}</Button>}>
        <p className="mb-3 text-small text-ink-secondary">{t("templates.description")}</p>
        <List>
          {data.templates.map((item) => (
            <ListRow
              key={item.id}
              title={item.title}
              description={
                <>
                  <span>{t("templates.by", { author: item.author, version: item.version })}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {item.included.map((kind) => (
                      <Tag key={kind} tone="outline">
                        {kind}
                      </Tag>
                    ))}
                  </span>
                </>
              }
              trailing={
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={soon}>
                    {t("actions.use")}
                  </Button>
                  <Button size="sm" onClick={soon}>
                    {t("actions.report")}
                  </Button>
                </div>
              }
            />
          ))}
        </List>
      </Card>
      <Card title={t("actions.author")} actions={<Button onClick={soon}>{t("actions.revenue")}</Button>}>
        <StatGroup>
          <Stat label={t("templates.effective_users")} value={formatCount(data.author.effective_users)} />
          <Stat label={t("templates.attainment")} value={formatPercent(data.author.attainment_ratio)} />
          <Stat label={t("templates.reports")} value={formatCount(data.author.reports)} />
          <Stat label={t("templates.updates")} value={formatCount(data.author.updates)} />
        </StatGroup>
        <p className="mt-3 text-small text-ink-secondary">{t("templates.incentive")}</p>
        <p className="mt-2 text-small text-ink-secondary">{t("templates.copyright")}</p>
      </Card>
      <Dialog
        open={publish}
        onClose={() => setPublish(false)}
        title={t("templates.publish_title")}
        description={t("templates.boundary")}
        actions={
          <Button variant="primary" onClick={soon}>
            {t("templates.publish_confirm")}
          </Button>
        }
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2">{t("templates.include")}</legend>
          {["map", "questions", "notes", "cards", "materials"].map((key) => (
            <label key={key} className="flex gap-2">
              <input type="checkbox" defaultChecked={key === "map"} />
              {t(`templates.content.${key}`)}
            </label>
          ))}
        </fieldset>
      </Dialog>
      <Banner>{t("summary.private")}</Banner>
    </div>
  );
}
