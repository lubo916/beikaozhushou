import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S19Notebook } from "@exam-prep/contract";
import { formatNumber, formatPercent } from "@exam-prep/shared/format";
import { AiContent, BarList, Button, Card, Columns, PageState, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

export function Insights({ data, onAnalyze, compact = false }: { data: S19Notebook; onAnalyze: () => void; compact?: boolean }) {
  const { t } = useTranslation("S19");
  const toast = useToast();
  const insights = data.insights;
  if (insights.restricted)
    return (
      <PageState
        state="restricted"
        compact={compact}
        title={t("state.restricted_title")}
        body={t("state.restricted_body", { cost: formatNumber(insights.analysis_cost, 0) })}
        action={
          <Link to={pathTo("S31")} className={buttonClass("secondary")}>
            {t("state.membership")}
          </Link>
        }
      />
    );
  if (!insights.available)
    return (
      <PageState
        state="insufficient_data"
        compact={compact}
        title={t("state.insufficient_title")}
        body={t("state.insufficient_body", { minimum: formatNumber(insights.minimum_count, 0) })}
        counts={[{ key: "sample", label: t("state.sample_count"), value: formatNumber(insights.sample_count, 0) }]}
      />
    );
  return (
    <div className="flex flex-col gap-4">
      <Columns
        main={
          <div className="flex flex-col gap-4">
            {/* feat:S19-12 聚类洞察，只用学员自己的订正 */}
            <Card title={t("insights.clusters")}>
              <AiContent note={t("insights.cluster_hint")}>
                <div className="flex flex-col gap-4">
                  {insights.clusters.map((cluster) => (
                    <div key={cluster.title}>
                      <h3 className="font-bold">{cluster.title}</h3>
                      <p>{cluster.body}</p>
                      <p className="mt-1 text-small text-ink-secondary">
                        {t("insights.cluster_count", { total: formatNumber(cluster.count, 0) })}
                      </p>
                    </div>
                  ))}
                </div>
              </AiContent>
            </Card>
            {/* feat:S19-16 陷阱画像：中招率、关联错题、针对性重做 */}
            <Card title={t("insights.traps")}>
              <p className="mb-3 text-small text-ink-secondary">{t("insights.trap_hint")}</p>
              <AiContent>
                <ul className="flex flex-col gap-4">
                  {insights.traps.map((trap) => (
                    <li key={trap.code}>
                      <strong>{t(`trap.${trap.code}`)}</strong>
                      <p>{t("insights.trap_rate", { rate: formatPercent(trap.hit_rate), total: formatNumber(trap.count, 0) })}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          className={buttonClass("secondary", "sm")}
                          to={`${pathTo("S19")}?view=all&trap=${encodeURIComponent(trap.code)}`}
                        >
                          {t("insights.related")}
                        </Link>
                        <Button size="sm" onClick={() => toast(t("soon_retry"))}>
                          {t("insights.targeted")}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </AiContent>
            </Card>
          </div>
        }
        aside={
          <div className="flex flex-col gap-4">
            {/* feat:S19-13 根因追溯沿前置知识点展示，只提建议 */}
            <Card title={t("insights.root")}>
              <AiContent>
                <ul className="flex flex-col gap-3">
                  {insights.root_points.map((point) => (
                    <li key={point.id}>
                      <Link className="text-brand-primary underline" to={pathTo("S10", { kpId: point.id })}>
                        {point.name}
                      </Link>
                      <p className="mt-1 text-small">{point.reason}</p>
                    </li>
                  ))}
                </ul>
              </AiContent>
            </Card>
            <Card title={t("insights.causes")}>
              <BarList
                label={t("insights.causes")}
                items={insights.causes.map((cause) => ({
                  key: cause.code,
                  label: t(`cause.${cause.code}`),
                  value: cause.count,
                  valueText: formatNumber(cause.count, 0),
                }))}
              />
            </Card>
            {/* feat:S19-14 批量分析事前告知点数 */}
            <Card title={t("insights.ai")} tone="ai">
              <p>{t("insights.ai_hint")}</p>
              <p className="my-3 text-small">{t("insights.cost", { cost: formatNumber(insights.analysis_cost, 0) })}</p>
              <Button onClick={onAnalyze}>{t("actions.batch")}</Button>
            </Card>
          </div>
        }
      />
    </div>
  );
}
