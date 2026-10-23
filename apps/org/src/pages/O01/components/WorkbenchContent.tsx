import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { O01Workbench, O01Metric } from "@exam-prep/contract";
import { formatCount, formatDuration, formatPercent } from "@exam-prep/shared/format";
import { AiContent, Button, Card, Columns, DataTable, Dialog, PageState, Stat, StatGroup, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { Link } from "../../../router/history.tsx";
import { pathTo, type PageId } from "../../../routes.ts";
export function metricValue(metric: O01Metric): string {
  return metric.format === "percent"
    ? formatPercent(metric.value)
    : metric.format === "minutes"
      ? formatDuration(metric.value)
      : formatCount(metric.value);
}
const TARGETS: Readonly<Record<string, PageId>> = { O09: "O09", O10: "O10", O02: "O02", O11: "O11", O05: "O05" };
export function WorkbenchContent({ data, offline }: { data: O01Workbench; offline: boolean }) {
  const { t } = useTranslation("O01");
  const toast = useToast();
  const [method, setMethod] = useState(false);
  const soon = () => toast(t("soon"));
  const restricted = data.access === "restricted";
  const insufficient = !data.sample_sufficient;
  const aggregateState = restricted ? (
    <PageState state="restricted" body={t("state.restricted.body")} />
  ) : insufficient ? (
    <PageState state="insufficient_data" body={t("state.insufficient_data.body", { minimum: data.minimum_group_size })} />
  ) : null;
  return (
    <>
      {/* feat:O01-03 业务指标只显示接口值，口径可查看。feat:O01-11 类型预设由接口响应切换。 */}
      <Card
        title={data.organization_name}
        meta={t("cardScope")}
        actions={
          <Button size="sm" onClick={() => setMethod(true)}>
            {t("method")}
          </Button>
        }
      >
        {restricted ? (
          <PageState state="restricted" title={t("state.restricted.title")} body={t("state.restricted.body")} />
        ) : insufficient ? (
          <PageState
            state="insufficient_data"
            title={t("state.insufficient_data.title")}
            body={t("state.insufficient_data.body", { minimum: data.minimum_group_size })}
            counts={[{ key: "sample", label: t("count"), value: formatCount(data.sample_count, t("person")) }]}
          />
        ) : (
          <StatGroup className="grid-cols-2 @content-md:grid-cols-4">
            {data.metrics.map((m) => (
              <Stat key={m.id} label={t(`metrics.${m.id}`)} value={metricValue(m)} />
            ))}
          </StatGroup>
        )}
      </Card>
      <Columns
        main={
          <div className="flex flex-col gap-4">
            {/* feat:O01-02 今日待办直达路由表中的处理页。 */}
            <Card title={t("todo")}>
              <div className="flex flex-col gap-2">
                {data.todos.map((todo) => (
                  <div className="flex items-center justify-between gap-3 border-b border-line-soft py-2" key={todo.id}>
                    <span>
                      {t(`todos.${todo.id}`)} <strong className="tabular-nums">{formatCount(todo.count)}</strong>
                    </span>
                    <Link className={buttonClass("secondary", "sm")} to={pathTo(TARGETS[todo.target] ?? "O01")}>
                      {t("process")}
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
            {/* feat:O01-05 受限和样本不足时接口移除统计，不呈现估算结论。 */}
            <Card
              title={t("health")}
              actions={
                <Link to={pathTo("O08")} className={buttonClass("ghost", "sm")}>
                  {t("process")}
                </Link>
              }
            >
              {restricted ? (
                <PageState state="restricted" body={t("state.restricted.body")} />
              ) : insufficient ? (
                <PageState state="insufficient_data" body={t("state.insufficient_data.body", { minimum: data.minimum_group_size })} />
              ) : (
                <DataTable
                  caption={t("health")}
                  stackOnNarrow
                  rowKey={(row) => row.id}
                  rows={data.classes}
                  columns={[
                    {
                      key: "name",
                      header: t("class"),
                      label: t("class"),
                      render: (row) => (
                        <Link className="text-brand-primary underline" to={pathTo("O03")}>
                          {row.name}
                        </Link>
                      ),
                    },
                    { key: "active", header: t("active"), label: t("active"), render: (row) => formatPercent(row.active) },
                    { key: "completion", header: t("completion"), label: t("completion"), render: (row) => formatPercent(row.completion) },
                    {
                      key: "risk",
                      header: t("risk"),
                      label: t("risk"),
                      render: (row) => (
                        <Link className="text-status-warning underline" to={pathTo("O08")}>
                          {formatCount(row.risk, t("person"))}
                        </Link>
                      ),
                    },
                  ]}
                />
              )}
            </Card>
            {/* feat:O01-06 分学员/员工通知，显示接口已读数；发布未接后端。 */}
            <Card
              title={t("notices")}
              actions={
                <Button size="sm" disabled={offline} onClick={soon}>
                  {t("publish")}
                </Button>
              }
            >
              <ul className="flex flex-col gap-3">
                {data.notices.map((notice) => (
                  <li key={notice.id}>
                    <p className="font-medium">{notice.title}</p>
                    <p className="text-small text-ink-tertiary">
                      {t(notice.audience)} · {t("read", { formatted_count: formatCount(notice.read_count) })}
                    </p>
                    <Button variant="ghost" size="sm" onClick={soon}>
                      {t("process")}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        }
        aside={
          <div className="flex flex-col gap-4">
            {/* feat:O01-08 导师节省工时，仅展示示例接口数据，口径可查。 */}
            <Card
              title={t("saving")}
              actions={
                <Button variant="ghost" size="sm" onClick={() => setMethod(true)}>
                  {t("method")}
                </Button>
              }
            >
              {aggregateState ?? (
                <dl className="flex flex-col gap-2">
                  {data.saving.map((m) => (
                    <div key={m.id} className="flex justify-between gap-2">
                      <dt>{t(`metrics.${m.id}`)}</dt>
                      <dd className="tabular-nums">{metricValue(m)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>
            {/* feat:O01-09 周报为 AI 生成示例，复制自带标识。 */}
            <Card
              title={t("weekly")}
              actions={
                <Button size="sm" disabled={offline || restricted || insufficient} onClick={soon}>
                  {t("weeklyAction")}
                </Button>
              }
            >
              {aggregateState ?? (
                <AiContent>
                  <p>{data.weekly_summary}</p>
                </AiContent>
              )}
            </Card>
            {/* feat:O01-10 相关考试节点提醒。 */}
            <Card title={t("nodes")}>
              <p>{data.node_reminder}</p>
              <Link className={buttonClass("ghost", "sm")} to={pathTo("O13")}>
                {t("overview")}
              </Link>
            </Card>
          </div>
        }
      />
      <Dialog open={method} onClose={() => setMethod(false)} title={t("method")}>
        <p>{t("methodBody")}</p>
      </Dialog>
    </>
  );
}
