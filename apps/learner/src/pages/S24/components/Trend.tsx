import { useTranslation } from "react-i18next";
import type { S24Progress } from "@exam-prep/contract";
import { formatDate, formatScore } from "@exam-prep/shared/format";
import { DataTable } from "@exam-prep/ui";

// 仅将接口分数映射到绘图坐标；不推算预测、差额或业务指标。
const LEFT = 28;
const RIGHT = 572;
const TOP = 20;
const BOTTOM = 190;
const LABEL_Y = 224;
/** 纵轴上下各留出数值跨度的这一比例，免得走势贴边（只影响画法）。 */
const PAD_RATIO = 0.15;

export function Trend({ data }: { data: S24Progress }) {
  const { t } = useTranslation("S24");
  const rows = data.trend;
  if (rows.length === 0) return null;
  const target = data.forecasts.today?.target_line;
  const values = [...rows.flatMap((row) => [row.conservative, row.optimistic]), ...(target === undefined ? [] : [target])];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = Math.max((high - low) * PAD_RATIO, 1);
  const floor = Math.max(0, low - pad);
  const ceiling = high + pad;
  const y = (value: number) => BOTTOM - ((value - floor) / (ceiling - floor)) * (BOTTOM - TOP);
  const x = (index: number) => LEFT + (index / Math.max(1, rows.length - 1)) * (RIGHT - LEFT);
  const line = rows.map((row, index) => x(index) + "," + y(row.likely)).join(" ");
  const band = [
    ...rows.map((row, index) => x(index) + "," + y(row.conservative)),
    ...rows.map((row, index) => x(index) + "," + y(row.optimistic)).reverse(),
  ].join(" ");
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <svg viewBox="0 0 600 240" className="w-full" role="img" aria-label={t("forecast.chart_label")}>
        <polygon points={band} fill="var(--color-brand-primary-soft)" />
        <polyline points={line} fill="none" stroke="var(--color-brand-primary)" strokeWidth="2" />
        {target !== undefined && (
          <>
            <line x1={LEFT} x2={RIGHT} y1={y(target)} y2={y(target)} stroke="var(--color-status-warning)" strokeDasharray="4 4" />
            <text x={RIGHT} y={y(target)} textAnchor="end" fill="var(--color-ink-secondary)" className="text-small">
              {t("forecast.target_line")} {formatScore(target)}
            </text>
          </>
        )}
        {rows.map((row, index) => (
          <text
            key={row.day}
            x={x(index)}
            y={LABEL_Y}
            textAnchor={index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"}
            fill="var(--color-ink-secondary)"
            className="text-small"
          >
            {formatDate(row.day)}
          </text>
        ))}
      </svg>
      <details>
        <summary className="cursor-pointer text-small text-brand-primary">{t("forecast.chart_data")}</summary>
        <DataTable
          caption={t("forecast.trend")}
          stackOnNarrow
          rows={rows}
          rowKey={(r) => r.day}
          columns={[
            { key: "day", header: t("forecast.date"), label: t("forecast.date"), render: (r) => formatDate(r.day) },
            ...(["conservative", "likely", "optimistic"] as const).map((key) => ({
              key,
              header: t("forecast." + key),
              label: t("forecast." + key),
              render: (r: S24Progress["trend"][number]) => formatScore(r[key]),
            })),
          ]}
        />
      </details>
    </div>
  );
}
