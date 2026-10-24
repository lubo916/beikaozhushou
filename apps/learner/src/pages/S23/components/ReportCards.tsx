import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S23Analysis, S23AssessmentReport } from "@exam-prep/contract";
import { formatCount, formatDuration, formatPercent, formatRange, formatScore } from "@exam-prep/shared/format";
import { Button, Card, DataTable, Dialog, KeyValueList, ProposalCard, Stat, StatGroup, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

// feat:S23-04 题型与知识点分析，得分率和正确率由接口分别给出。
export function AnalysisCard({ title, rows, points = false }: { title: string; rows: S23Analysis[]; points?: boolean }) {
  const { t } = useTranslation("S23");
  return (
    <Card title={title} flush>
      <DataTable
        caption={title}
        rows={rows}
        rowKey={(r) => r.id}
        stackOnNarrow
        columns={[
          {
            key: "name",
            header: t("analysis.name"),
            label: t("analysis.name"),
            render: (r) =>
              points ? (
                <Link
                  aria-label={t("analysis.open_point", { name: r.name })}
                  className="text-brand-primary underline"
                  to={pathTo("S10", { kpId: r.id })}
                >
                  {r.name}
                </Link>
              ) : (
                r.name
              ),
          },
          {
            key: "score",
            header: t("analysis.score"),
            label: t("analysis.score"),
            render: (r) => formatScore(r.score, { total: r.total }),
          },
          { key: "rate", header: t("analysis.rate"), label: t("analysis.rate"), render: (r) => formatPercent(r.rate) },
          { key: "note", header: t("analysis.note"), label: t("analysis.note"), render: (r) => r.note },
        ]}
      />
    </Card>
  );
}
// feat:S23-05 时间策略：各部分、末段完成率与原作答顺序。
export function TimingCard({ report }: { report: S23AssessmentReport }) {
  const { t } = useTranslation("S23");
  return (
    <Card title={t("timing.title")} flush footer={t("timing.tail")}>
      <DataTable
        caption={t("timing.title")}
        rows={report.time_strategy}
        rowKey={(r) => r.id}
        stackOnNarrow
        columns={[
          { key: "part", header: t("timing.part"), label: t("timing.part"), render: (r) => r.name },
          { key: "actual", header: t("timing.actual"), label: t("timing.actual"), render: (r) => formatDuration(r.actual_minutes) },
          {
            key: "suggested",
            header: t("timing.suggested"),
            label: t("timing.suggested"),
            render: (r) => formatDuration(r.suggested_minutes),
          },
          {
            key: "completion",
            header: t("timing.completion"),
            label: t("timing.completion"),
            render: (r) => formatPercent(r.completion_rate),
          },
          {
            key: "order",
            header: t("timing.order"),
            label: t("timing.order"),
            render: (r) => (
              <>
                {r.order}
                <p className="text-small text-ink-secondary">{r.note}</p>
              </>
            ),
          },
        ]}
      />
    </Card>
  );
}
// feat:S23-09 把握度校准：只展示接口返回的次数和比例。
export function ConfidenceCard({ report }: { report: S23AssessmentReport }) {
  const { t } = useTranslation("S23");
  const c = report.confidence;
  return (
    <Card title={t("confidence.title")}>
      <StatGroup>
        <Stat
          label={t("confidence.sure_wrong")}
          value={formatPercent(c.sure_wrong_ratio)}
          hint={formatCount(c.sure_wrong_count, t("unit.question"))}
          tone="warning"
        />
        <Stat
          label={t("confidence.guess_correct")}
          value={formatPercent(c.guess_correct_ratio)}
          hint={formatCount(c.guess_correct_count, t("unit.question"))}
        />
      </StatGroup>
      <p className="mt-3 text-small text-ink-secondary">{c.advice}</p>
    </Card>
  );
}
// feat:S23-10 策略模拟：接口返回的确定性示例估计；尝试顺序不修改分数与预测。
export function SimulationCard({ report }: { report: S23AssessmentReport }) {
  const { t } = useTranslation("S23");
  const toast = useToast();
  const s = report.simulation;
  return (
    <Card title={t("simulation.title")}>
      <p className="mb-3 text-small text-ink-secondary">{t("simulation.hint")}</p>
      <KeyValueList
        items={[
          { key: "before", label: t("simulation.before"), value: s.before_order },
          { key: "after", label: t("simulation.after"), value: s.after_order },
        ]}
      />
      <p className="mt-3 font-medium text-status-success">
        {t("simulation.gain", { score: formatRange(s.gain_low, s.gain_high, t("unit.score")) })}
      </p>
      <p className="mt-2 text-small text-ink-secondary">{s.note}</p>
      <Button className="mt-3" onClick={() => toast(t("soon"))}>
        {t("simulation.try")}
      </Button>
    </Card>
  );
}
// feat:S23-08 补强清单按接口的性价比顺序展示；修改计划只能成为待确认的提议。
export function ReinforcementCard({ report }: { report: S23AssessmentReport }) {
  const { t } = useTranslation("S23");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const p = report.reinforcement;
  return (
    <>
      <Card title={t("plan.title")} meta={t("plan.days", { days: formatCount(p.days) })}>
        <ul className="flex flex-col divide-y divide-line-soft">
          {p.tasks.map((task) => (
            <li key={task.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone="brand">{task.tier}</Tag>
                <h3 className="font-medium">{task.name}</h3>
              </div>
              <p className="text-small text-ink-secondary">
                {task.day_label} · {formatDuration(task.minutes)}
              </p>
              <p>{task.reason}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setOpen(true)}>
            {t("plan.propose")}
          </Button>
          <Link to={pathTo("S06")} className={buttonClass("secondary")}>
            {t("plan.today")}
          </Link>
        </div>
      </Card>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("plan.dialog")}
        description={t("plan.note")}
        actions={
          <>
            <Link to={pathTo("S07")} className={buttonClass("secondary")}>
              {t("plan.plan")}
            </Link>
            <Button onClick={() => setOpen(false)}>{t("plan.later")}</Button>
          </>
        }
      >
        <p className="mb-3 text-small text-ink-secondary">{t("plan.source")}</p>
        <ProposalCard
          title={t("plan.dialog")}
          status="pending"
          what={p.proposal.what}
          why={p.proposal.why}
          cost={p.proposal.cost}
          ifNot={p.proposal.if_not}
          onConfirm={() => toast(t("soon"))}
          onDecline={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
