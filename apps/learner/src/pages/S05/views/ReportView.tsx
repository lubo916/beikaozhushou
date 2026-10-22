import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S05StartReport } from "@exam-prep/contract";
import { formatCount, formatDate, formatDuration, formatRange } from "@exam-prep/shared/format";
import { AiContent, Button, Card, DataTable, Dialog, PageState, Tag, buttonClass, cx } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";
import { Forecast, Overview } from "../components/ReportOverview.tsx";
import { GapTable, ScopeDraft } from "../components/ScopeAndGaps.tsx";

type Scheme = S05StartReport["schemes"][number];

/** feat:S05-10 体检不通过：英雄区换成锁定提示和逐项修复清单，其余区块照常（决定 U05-Q1＝A）。 */
function MapRepairs({ data }: { data: S05StartReport }) {
  const { t } = useTranslation("S05");
  const toast = useToast();
  return (
    <>
      <PageState
        state="locked"
        title={t("locked.title")}
        body={t("locked.body")}
        action={
          <Link to={pathTo("S09")} className={buttonClass("primary")}>
            {t("locked.fix")}
          </Link>
        }
      />
      <Card id="s05-repairs" title={t("locked.repairs_title")}>
        <ul className="flex flex-col gap-3">
          {data.repairs.map((repair) => (
            <li className="flex flex-wrap items-center justify-between gap-2" key={repair.kind}>
              <span>{t(`locked.item.${repair.kind}`, { amount: formatCount(repair.count) })}</span>
              <Link to={pathTo("S09")} className={buttonClass("secondary", "sm")}>
                {t("locked.fix")}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => toast(t("soon.recheck"))}>{t("locked.recheck")}</Button>
          <span className="text-small text-ink-tertiary">{t("locked.recheck_note")}</span>
        </div>
        <p className="mt-3 text-small text-ink-tertiary">{t("locked.distribution")}</p>
      </Card>
    </>
  );
}

export function ReportView({ data, offline }: { data: S05StartReport; offline: boolean }) {
  const { t } = useTranslation("S05");
  const toast = useToast();
  const [selected, setSelected] = useState<Scheme["id"] | undefined>(
    () => data.schemes.find((scheme) => scheme.recommended)?.id ?? data.schemes[0]?.id,
  );
  const [preview, setPreview] = useState(false);
  const scheme = data.schemes.find((item) => item.id === selected);
  // 地图体检不通过时只锁预测类数字（预测区间、可提分、方案预期与区间上移、范围的分数代价），其余照常。
  const locked = data.map_health === "blocked";
  return (
    <>
      {data.guest && <PageState state="restricted" compact title={t("state.restricted.title")} body={t("state.restricted.body")} />}
      {/* feat:S05-12 快速定位也保留完整报告和方案，区间由模拟接口放宽。 */}
      {data.view === "quick" && (
        <PageState
          state="insufficient_data"
          compact
          title={t("state.quick.title")}
          body={t("state.quick.body")}
          action={
            <Link className={buttonClass("secondary", "sm")} to={pathTo("S04")}>
              {t("state.quick.action")}
            </Link>
          }
        />
      )}
      {locked ? <MapRepairs data={data} /> : <Forecast data={data} />}
      <a href="#s05-schemes" className={cx(buttonClass("primary"), "self-start @tablet:hidden")}>
        {t("hero.jump")}
      </a>
      <Overview data={data} />
      <GapTable data={data} locked={locked} />
      <ScopeDraft data={data} locked={locked} />
      {/* feat:S05-07 三档只影响本页选择；不会未确认就改变计划。feat:S05-13 边际收益来自接口；体检不通过时不显示预期与上移。 */}
      <Card id="s05-schemes" title={t("schemes.title")}>
        <p className="mb-4 text-small text-ink-tertiary">{t(locked ? "schemes.locked_hint" : "schemes.hint")}</p>
        <div role="radiogroup" aria-label={t("schemes.group")} className="grid grid-cols-1 gap-3 @tablet:grid-cols-3">
          {data.schemes.map((option) => (
            <label
              key={option.id}
              className={cx(
                "flex min-w-0 cursor-pointer flex-col gap-3 rounded-md border p-4",
                selected === option.id ? "border-brand-primary bg-brand-primary-soft" : "border-line-strong bg-bg-surface",
              )}
            >
              <span className="flex flex-wrap items-center gap-2">
                <input
                  type="radio"
                  name="s05-scheme"
                  value={option.id}
                  checked={selected === option.id}
                  onChange={() => setSelected(option.id)}
                  aria-label={t(`schemes.name.${option.id}`)}
                />
                <strong>{t(`schemes.name.${option.id}`)}</strong>
                {option.recommended && (
                  <Tag tone="brand" size="sm">
                    {t("schemes.recommended")}
                  </Tag>
                )}
              </span>
              <strong className="text-title tabular-nums">{t("schemes.daily", { duration: formatDuration(option.daily_minutes) })}</strong>
              <span>{t("schemes.weekly", { duration: formatDuration(option.weekly_minutes) })}</span>
              {!locked && (
                <span className="text-ink-secondary">
                  {t("schemes.expected")} <strong className="tabular-nums">{formatRange(option.low, option.high, t("hero.unit"))}</strong>
                </span>
              )}
              <span className="text-small text-ink-secondary">{t(`schemes.cost.${option.id}`)}</span>
              {!locked && (
                <span className="border-t border-line-soft pt-3 text-small text-ink-tertiary">
                  {option.id === "steady"
                    ? t("schemes.baseline")
                    : t("schemes.marginal", {
                        duration: formatDuration(option.extra_weekly_minutes),
                        score: formatRange(option.uplift_low, option.uplift_high, t("hero.unit")),
                      })}
                </span>
              )}
            </label>
          ))}
        </div>
      </Card>
      {/* feat:S05-11 轮次与学法草案，不在页面生成排程。 */}
      <Card title={t("rounds.title")}>
        <ol className="grid grid-cols-1 gap-4 @tablet:grid-cols-2 @desktop:grid-cols-4">
          {data.rounds.map((round) => (
            <li key={round.id} className="border-l border-brand-primary pl-4">
              <h3 className="font-medium">
                {t("rounds.round", { amount: formatCount(round.ordinal), name: t(`rounds.name.${round.kind}`) })}
              </h3>
              <p className="my-2 text-small text-ink-tertiary">
                {t("rounds.dates", { start: formatDate(round.start), end: formatDate(round.end) })}
              </p>
              <p className="text-small text-ink-secondary">{t(`rounds.method.${round.kind}`)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-small text-ink-tertiary">{t("rounds.note")}</p>
      </Card>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {data.guest && <span className="text-small text-ink-tertiary">{t("plan.guest_hint")}</span>}
        <Button variant="primary" disabled={scheme === undefined || offline} onClick={() => setPreview(true)}>
          {t("plan.generate")}
        </Button>
      </div>
      {/* feat:S05-08 先展示轮次路线和第一周内容；feat:S05-09 产生值得保存的内容后才要求登录。 */}
      {preview && (
        <Dialog
          open={preview}
          onClose={() => setPreview(false)}
          title={t("plan.title")}
          description={data.guest ? t("plan.description") : undefined}
          actions={
            <>
              <Button onClick={() => setPreview(false)}>{t("plan.cancel")}</Button>
              {data.guest ? (
                <Link to={pathTo("S01")} className={buttonClass("primary")}>
                  {t("plan.login")}
                </Link>
              ) : (
                <Button variant="primary" onClick={() => toast(t("soon.save"))}>
                  {t("plan.save")}
                </Button>
              )}
            </>
          }
        >
          {scheme !== undefined && (
            <>
              <p className="font-medium">{t("plan.chosen", { name: t(`schemes.name.${scheme.id}`) })}</p>
              <p className="my-3">
                {t("plan.week", { duration: formatDuration(scheme.first_week_minutes), amount: formatCount(scheme.first_week_tasks) })}
              </p>
              <AiContent note={t("plan.ai_note")}>
                <p>{t("plan.logic")}</p>
              </AiContent>
              <div className="mt-4">
                <DataTable
                  caption={t("plan.title")}
                  stackOnNarrow
                  rows={scheme.day_plan}
                  rowKey={(row) => row.day}
                  columns={[
                    { key: "day", header: t("plan.day"), label: t("plan.day"), render: (row) => formatDate(row.day, { weekday: true }) },
                    { key: "minutes", header: t("plan.minutes"), label: t("plan.minutes"), render: (row) => formatDuration(row.minutes) },
                    {
                      key: "tasks",
                      header: t("plan.tasks"),
                      label: t("plan.tasks"),
                      render: (row) => (
                        <ul>
                          {row.tasks.map((task) => (
                            <li key={task}>{t(`plan.items.${task}`)}</li>
                          ))}
                        </ul>
                      ),
                    },
                  ]}
                />
              </div>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
