import { useTranslation } from "react-i18next";
import type { S24Progress } from "@exam-prep/contract";
import { formatNumber, formatPercent, formatScore } from "@exam-prep/shared/format";
import { AiContent, BarList, Button, Card, Columns, KeyValueList, ProgressBar } from "@exam-prep/ui";
import { ForecastLock } from "../components/ForecastLock.tsx";
export function Diagnosis({ data, soon }: { data: S24Progress; soon: () => void }) {
  const { t } = useTranslation("S24");
  return (
    <div className="flex flex-col gap-4">
      {/* feat:S24-18 差距分解只展示接口排序，操作只生成待确认提议。 */}
      {data.map_check === "blocked" ? (
        <ForecastLock data={data} />
      ) : (
        <Card
          title={t("diagnosis.gap")}
          actions={
            <Button variant="primary" onClick={soon}>
              {t("diagnosis.proposal")}
            </Button>
          }
          footer={t("diagnosis.proposal_note")}
        >
          <AiContent>
            <div className="flex flex-col gap-3">
              {data.gaps.map((g) => (
                <div key={g.source} className="flex flex-wrap justify-between gap-2">
                  <p>
                    {t("diagnosis.source." + g.source)} · {formatScore(g.score)}
                  </p>
                  <p className="text-small text-ink-secondary">{g.action}</p>
                </div>
              ))}
            </div>
          </AiContent>
        </Card>
      )}
      <Columns
        main={
          <div className="flex flex-col gap-4">
            {/* feat:S24-14 行动建议只生成待确认的提议，确认前不改今日清单。 */}
            <Card title={t("diagnosis.weak")} footer={t("diagnosis.add_note")}>
              <AiContent note={t("diagnosis.ai_note")}>
                <div className="flex flex-col gap-4">
                  {data.weaknesses.map((w) => (
                    <div key={w.dimension}>
                      <ProgressBar label={t("diagnosis.dimension." + w.dimension) + " · " + w.name} value={w.ratio} tone="warning" />
                      <p className="my-2 text-small text-ink-secondary">{w.action}</p>
                      <Button size="sm" onClick={soon}>
                        {t("diagnosis.add_today")}
                      </Button>
                    </div>
                  ))}
                </div>
              </AiContent>
            </Card>
            {/* feat:S24-12 */}
            <Card title={t("diagnosis.layers")}>
              <div className="flex flex-col gap-4">
                {data.layers.map((l) => (
                  <div key={l.kind}>
                    <ProgressBar label={t("diagnosis.layer." + l.kind)} value={l.ratio} />
                    <p className="my-2 text-small text-ink-secondary">{l.note}</p>
                    <Button size="sm" onClick={soon}>
                      {t("diagnosis.layer_detail", { name: t("diagnosis.layer." + l.kind) })}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        }
        aside={
          <div className="flex flex-col gap-4">
            {/* feat:S24-16 */}
            <Card title={t("diagnosis.confidence")}>
              <KeyValueList
                items={[
                  {
                    key: "over",
                    label: t("diagnosis.overconfident"),
                    value: t("diagnosis.points", { amount: formatNumber(data.confidence.overconfident) }),
                  },
                  {
                    key: "under",
                    label: t("diagnosis.underconfident"),
                    value: t("diagnosis.points", { amount: formatNumber(data.confidence.underconfident) }),
                  },
                ]}
              />
              <p className="text-small text-ink-secondary">{data.confidence.note}</p>
            </Card>
            {/* feat:S24-15 */}
            <Card title={t("diagnosis.methods")}>
              <BarList
                label={t("diagnosis.methods")}
                max={1}
                items={data.methods.map((m) => ({ key: m.name, label: m.name, value: m.ratio, valueText: formatPercent(m.ratio) }))}
              />
            </Card>
            <Card title={t("diagnosis.periods")}>
              <BarList
                label={t("diagnosis.periods")}
                max={1}
                items={data.periods.map((m) => ({ key: m.name, label: m.name, value: m.ratio, valueText: formatPercent(m.ratio) }))}
              />
            </Card>
          </div>
        }
      />
    </div>
  );
}
