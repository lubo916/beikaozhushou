import { OrgPageRuntime } from "../O01/runtime.tsx";
// O02 招生与线索：机构端简版主视图；P1 的真实写入在后端接通后补齐。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { param } from "@exam-prep/params";
import { formatCount, formatPercent } from "@exam-prep/shared/format";
import {
  AiContent,
  Banner,
  Button,
  Card,
  Columns,
  ContainerScope,
  DataTable,
  Dialog,
  PageHeader,
  PageState,
  Stat,
  StatGroup,
  Tag,
  buttonClass,
} from "@exam-prep/ui";
import type { O02Lead, O02Leads } from "@exam-prep/contract";
import { useToast } from "../../app/toast.tsx";
import { Link, useLocation } from "../../router/history.tsx";
import { pathTo } from "../../routes.ts";
import { useLeads } from "./data.ts";
import { visibleLead } from "./view.ts";

export default function Page() {
  const { search } = useLocation();
  return (
    <OrgPageRuntime pageId="O02">
      <LeadsPage key={search} />
    </OrgPageRuntime>
  );
}

function LeadsPage() {
  const { t } = useTranslation("O02");
  const toast = useToast();
  const home = useLeads();
  const [selection, setSelected] = useState<O02Lead | undefined>();
  const selected = visibleLead(selection, home);
  const soon = () => toast(t("soon"));
  const data = home.data;
  return (
    <ContainerScope className="mx-auto flex w-full max-w-content-lg flex-col gap-4">
      <PageHeader
        title={t("title")}
        eyebrow={t("eyebrow")}
        description={t("description")}
        meta={
          <>
            <Tag tone="warning">{t("sample")}</Tag>
            {data !== undefined && <Tag>{t("exam", { name: data.exam_name })}</Tag>}
          </>
        }
        actions={
          <>
            <Button onClick={soon}>{t("action.add")}</Button>
            <Button variant="primary" onClick={soon}>
              {t("action.diagnostic")}
            </Button>
          </>
        }
      />
      {home.state === "loading" ? (
        <PageState state="loading" pageName={t("title")} slowHintAfterSeconds={param("ui.loading.slow_hint_seconds")} />
      ) : home.state === "offline" ? (
        <PageState
          state="offline"
          pageName={t("title")}
          body={t("state.offline.body")}
          action={<Button onClick={home.retry}>{t("action.retry")}</Button>}
        />
      ) : home.state === "error" ? (
        <PageState state="error" pageName={t("title")} audience="staff" body={t("state.error.body")} onRetry={home.retry} onReport={soon} />
      ) : home.state === "restricted" ? (
        <>
          <PageState
            state="restricted"
            title={t("state.restricted.title")}
            body={t("state.restricted.body")}
            action={
              <Link className={buttonClass("secondary")} to={pathTo("O15")}>
                {t("action.review")}
              </Link>
            }
          />
          <Compliance />
        </>
      ) : home.state === "empty" ? (
        <PageState
          state="empty"
          title={t("state.empty.title")}
          body={t("state.empty.body")}
          action={
            <Link className={buttonClass("primary")} to={pathTo("O03")}>
              {t("state.empty.action")}
            </Link>
          }
        />
      ) : data !== undefined ? (
        <>
          {home.stale && <Banner tone="warning" title={t("state.offline.body")} />}
          {data.sample_sufficient ? (
            <StatGroup>
              <Stat label={t("summary.new")} value={formatCount(data.summary.new_leads)} />
              <Stat label={t("summary.due")} value={formatCount(data.summary.followup_due)} tone="warning" />
              <Stat label={t("summary.trial")} value={formatCount(data.summary.trial_booked)} />
              <Stat
                label={t("summary.enrolled")}
                value={formatCount(data.summary.enrolled)}
                tone="success"
                hint={t("summary.conversion") + " " + formatPercent(data.summary.conversion_ratio)}
              />
            </StatGroup>
          ) : (
            <PageState
              state="insufficient_data"
              title={t("state.insufficient_data.title")}
              body={t("state.insufficient_data.body", { minimum: formatCount(data.minimum_group_size) })}
              counts={[{ key: "sample", label: t("state.insufficient_data.count"), value: formatCount(data.sample_count) }]}
              missing={t("state.insufficient_data.missing")}
            />
          )}
          <Columns
            main={
              <div className="flex min-w-0 flex-col gap-4">
                {/* feat:O02-03 线索池与评分；优先级由接口给出，不在页面计算。 */}
                {/* feat:O02-04 跟进任务：展示接口给出的跟进提醒，动作暂提示即将上线。 */}
                <Card
                  title={t("pool.title")}
                  meta={t("pool.description")}
                  actions={
                    <Button size="sm" onClick={soon}>
                      {t("action.follow")}
                    </Button>
                  }
                >
                  <DataTable
                    caption={t("pool.title")}
                    stackOnNarrow
                    rows={data.leads}
                    rowKey={(lead) => lead.id}
                    columns={[
                      {
                        key: "name",
                        header: t("pool.name"),
                        label: t("pool.name"),
                        render: (lead) => (
                          <div>
                            <strong>{lead.name}</strong>
                            <p className="text-small text-ink-tertiary">{lead.phone_masked}</p>
                          </div>
                        ),
                      },
                      {
                        key: "source",
                        header: t("pool.source"),
                        label: t("pool.source"),
                        render: (lead) => (
                          <div>
                            {lead.source}
                            <p className="text-small text-ink-tertiary">{lead.intent}</p>
                          </div>
                        ),
                      },
                      { key: "level", header: t("pool.level"), label: t("pool.level"), render: (lead) => lead.level },
                      {
                        key: "status",
                        header: t("pool.status"),
                        label: t("pool.status"),
                        render: (lead) => (
                          <div>
                            <Tag tone={lead.priority === "high" ? "warning" : "neutral"}>{t(`pool.priority.${lead.priority}`)}</Tag>
                            <p>{lead.status}</p>
                            <p className="text-small text-ink-tertiary">{lead.followup_label}</p>
                          </div>
                        ),
                      },
                      {
                        key: "action",
                        header: t("pool.action"),
                        label: t("pool.action"),
                        render: (lead) => (
                          <Button size="sm" onClick={() => setSelected(lead)}>
                            {t("action.details")}
                          </Button>
                        ),
                      },
                    ]}
                  />
                </Card>
                {/* feat:O02-08 转化漏斗与渠道分析：只展示接口返回的原始数。 */}
                <Card title={t("channels.title")}>
                  {!data.sample_sufficient && <p className="text-small text-ink-tertiary">{t("channels.private")}</p>}
                  <DataTable
                    caption={t("channels.title")}
                    stackOnNarrow
                    rows={data.channels}
                    rowKey={(row) => row.id}
                    columns={[
                      { key: "name", header: t("channels.name"), label: t("channels.name"), render: (row) => row.name },
                      {
                        key: "leads",
                        header: t("channels.leads"),
                        label: t("channels.leads"),
                        render: (row) => formatCount(row.leads, t("channels.count")),
                      },
                      {
                        key: "trial",
                        header: t("channels.trial"),
                        label: t("channels.trial"),
                        render: (row) => formatCount(row.trial, t("channels.count")),
                      },
                      {
                        key: "enrolled",
                        header: t("channels.enrolled"),
                        label: t("channels.enrolled"),
                        render: (row) => formatCount(row.enrolled, t("channels.count")),
                      },
                    ]}
                  />
                </Card>
              </div>
            }
            aside={
              <div className="flex min-w-0 flex-col gap-4">
                {/* feat:O02-02 品牌化诊断测评 */}
                <Card title={t("campaign.title")}>
                  <Tag tone="brand">{data.campaign.brand}</Tag>
                  <strong>{data.campaign.title}</strong>
                  <p>{data.campaign.description}</p>
                  <p className="text-small text-ink-tertiary">{t("campaign.hint")}</p>
                  <Button onClick={soon}>{t("action.diagnostic")}</Button>
                </Card>
                <Compliance data={data.compliance} />
                {/* feat:O02-05 试听与体验班 */}
                {/* feat:O02-06 报名、协议与收款 */}
                {/* feat:O02-07 退费办理：简版先给入口，不进行金额试算与真实写入。 */}
                <Card title={t("action.trial")}>
                  <Button onClick={soon}>{t("action.trial")}</Button>
                  <Button onClick={soon}>{t("action.enroll")}</Button>
                  <Button onClick={soon}>{t("action.refund")}</Button>
                </Card>
              </div>
            }
          />
        </>
      ) : null}
      {/* feat:O02-11 线索沟通要点：示例 AI 内容带显式标识。 */}
      <Dialog
        open={selected !== undefined}
        onClose={() => setSelected(undefined)}
        title={t("communication.title")}
        description={selected?.name}
        actions={<Button onClick={() => setSelected(undefined)}>{t("action.close")}</Button>}
      >
        {selected !== undefined && (
          <AiContent>
            <p>{selected.communication}</p>
          </AiContent>
        )}
        <p className="text-small text-ink-tertiary">{t("communication.note")}</p>
      </Dialog>
    </ContainerScope>
  );
}

function Compliance({ data }: { data?: O02Leads["compliance"] }) {
  const { t } = useTranslation("O02");
  const toast = useToast();
  const [draft, setDraft] = useState(data?.sample_text ?? "");
  // feat:O02-01 宣传合规检测：正式检测未接后端，按钮按简版约定提示即将上线，不用页面算法给出合规结论。
  return (
    <Card title={t("compliance.title")} meta={t("compliance.description")}>
      <label className="flex flex-col gap-2">
        {t("compliance.label")}
        <textarea
          rows={4}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="w-full rounded-sm border border-line-strong bg-bg-surface p-2 text-ink-primary"
        />
      </label>
      <Button variant="primary" onClick={() => toast(t(draft.trim() === "" ? "compliance.empty" : "soon"))}>
        {t("action.check")}
      </Button>
      {data !== undefined && (
        <div className="flex flex-col gap-2 rounded-sm bg-bg-sunk p-3">
          <Tag>{t("compliance.sample_result")}</Tag>
          <strong>{data.result}</strong>
          <p>{data.advice}</p>
          <p className="text-small text-ink-tertiary">{t("compliance.result_note")}</p>
        </div>
      )}
    </Card>
  );
}
