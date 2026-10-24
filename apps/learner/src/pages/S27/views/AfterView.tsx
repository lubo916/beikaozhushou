import { useState } from "react";
import type { S27SprintHome } from "@exam-prep/contract";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { formatCount, formatDuration, formatRange, formatScore } from "@exam-prep/shared/format";
import { Banner, Button, Card, Columns, DataTable, Dialog, PageState, Stat, StatGroup, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

export function AfterView({ data, soon }: { data: S27SprintHome; soon: () => void }) {
  const { t } = useTranslation("S27");
  const [register, setRegister] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const next = [
    { key: "next_subject", page: "S02" },
    { key: "retry", page: "S08" },
    { key: "transfer", page: "S02" },
  ] as const;
  return (
    <div className="flex flex-col gap-4" data-testid="S27-after">
      <Columns
        main={
          <div className="flex flex-col gap-4">
            {/* feat:S27-10 区间直接来自接口，不在页面估算。 */}
            <Card title={t("after.estimate.title")} footer={<Button onClick={soon}>{t("after.estimate.action")}</Button>}>
              <p>{t("after.estimate.body")}</p>
              <DataTable
                caption={t("after.estimate.title")}
                stackOnNarrow
                rows={data.estimates}
                rowKey={(row) => row.subject_key}
                columns={[
                  {
                    key: "subject",
                    header: t("after.estimate.subject"),
                    label: t("after.estimate.subject"),
                    render: (row) => t(`subject.${row.subject_key}`),
                  },
                  {
                    key: "objective",
                    header: t("after.estimate.objective"),
                    label: t("after.estimate.objective"),
                    render: (row) => formatScore(row.objective),
                  },
                  {
                    key: "subjective",
                    header: t("after.estimate.subjective"),
                    label: t("after.estimate.subjective"),
                    render: (row) => formatRange(row.subjective_low, row.subjective_high, t("unit.score")),
                  },
                  {
                    key: "total",
                    header: t("after.estimate.total"),
                    label: t("after.estimate.total"),
                    render: (row) => <strong>{formatRange(row.total_low, row.total_high, t("unit.score"))}</strong>,
                  },
                ]}
              />
            </Card>
            {/* feat:S27-04 登记只是草稿演示，不回写学习证据或在页面校准。 */}
            <Card
              title={t("after.grades.title")}
              actions={
                <Button
                  variant="primary"
                  onClick={() => {
                    setSubmitted(false);
                    setRegister(true);
                  }}
                >
                  {t("after.grades.action")}
                </Button>
              }
            >
              <p>{t("after.grades.body")}</p>
            </Card>
            {/* feat:S27-11 */}
            <Card title={t("after.next.title")}>
              <p>{t("after.next.body")}</p>
              <ul className="ui-list ui-list--divided">
                {next.map((item) => (
                  <li key={item.key} className="flex flex-col gap-2 py-3">
                    <h3 className="font-bold">{t(`after.next.${item.key}.title`)}</h3>
                    <p>{t(`after.next.${item.key}.body`)}</p>
                    <Link className={buttonClass("secondary")} to={pathTo(item.page)}>
                      {t(`after.next.${item.key}.action`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        }
        aside={
          <div className="flex flex-col gap-4">
            {/* feat:S27-05 */}
            <Card
              title={t("after.archive.title")}
              footer={
                <div className="flex flex-wrap gap-2">
                  <Button onClick={soon}>{t("after.archive.action")}</Button>
                  <Link to={pathTo("S34")} className={buttonClass("secondary")}>
                    {t("after.archive.open")}
                  </Link>
                </div>
              }
            >
              <div className="flex flex-col gap-3">
                <p>{t("after.archive.body")}</p>
                <StatGroup>
                  <Stat label={t("after.archive.study")} value={formatDuration(data.archive.study_minutes)} />
                  <Stat label={t("after.archive.sessions")} value={formatCount(data.archive.sessions, t("unit.record"))} />
                  <Stat label={t("after.archive.cards")} value={formatCount(data.archive.cards, t("unit.card"))} />
                  <Stat label={t("after.archive.mistakes")} value={formatCount(data.archive.mistakes, t("unit.question"))} />
                </StatGroup>
              </div>
            </Card>
            <Card title={t("after.compare.title")}>
              <p>{t("after.compare.body")}</p>
              {!data.calibration_ready ? (
                <PageState state="insufficient_data" title={t("state.insufficient_data.title")} body={t("state.insufficient_data.body")} />
              ) : (
                <DataTable
                  caption={t("after.compare.title")}
                  stackOnNarrow
                  rows={data.grades}
                  rowKey={(row) => row.subject_key}
                  columns={[
                    {
                      key: "subject",
                      header: t("after.estimate.subject"),
                      label: t("after.estimate.subject"),
                      render: (row) => t(`subject.${row.subject_key}`),
                    },
                    {
                      key: "forecast",
                      header: t("after.compare.forecast"),
                      label: t("after.compare.forecast"),
                      render: (row) => formatRange(row.forecast_low, row.forecast_high, t("unit.score")),
                    },
                    {
                      key: "actual",
                      header: t("after.compare.actual"),
                      label: t("after.compare.actual"),
                      render: (row) => (row.actual === undefined ? t("after.grades.unrecorded") : formatScore(row.actual)),
                    },
                  ]}
                />
              )}
            </Card>
          </div>
        }
      />
      <Dialog open={register} onClose={() => setRegister(false)} title={t("after.grades.dialog")} description={t("after.grades.hint")}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
        >
          {submitted && <Banner tone="warning">{t("soon")}</Banner>}
          <label className="flex flex-col gap-1">
            {t("after.grades.subject")}
            <select name="subject" className="min-w-[0] rounded-sm border border-line-strong bg-bg-surface px-3 py-2">
              {data.estimates.map((row) => (
                <option key={row.subject_key} value={row.subject_key}>
                  {t(`subject.${row.subject_key}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            {t("after.grades.score")}
            <input
              name="score"
              type="number"
              step="any"
              required
              className="min-w-[0] rounded-sm border border-line-strong bg-bg-surface px-3 py-2"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary">
              {t("after.grades.save")}
            </Button>
            <Button onClick={() => setRegister(false)}>{t("after.grades.cancel")}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
