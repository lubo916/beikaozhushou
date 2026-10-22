import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import type { S05StartReport } from "@exam-prep/contract";
import { formatCount, formatDays, formatDuration, formatPercent, formatRange, formatScore } from "@exam-prep/shared/format";
import type { MasteryRank } from "@exam-prep/shared/vocab";
import {
  AiContent,
  BarList,
  Card,
  Columns,
  DataTable,
  KeyValueList,
  MasteryGrid,
  Stat,
  StatGroup,
  Tabs,
  Tag,
  buttonClass,
} from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

export function Forecast({ data }: { data: S05StartReport }) {
  const { t } = useTranslation("S05");
  const forecast = data.forecast;
  if (forecast === undefined || data.map_health === "blocked") return null;
  // feat:S05-01 区间、差额、目标线、证据量与置信程度只显示接口值。
  return (
    <Card title={t("hero.title")} tone="brand">
      <StatGroup>
        <Stat label={t("hero.forecast")} value={formatRange(forecast.low, forecast.high, t("hero.unit"))} tone="brand" />
        <Stat label={t("hero.target")} value={formatScore(forecast.target)} />
        {forecast.pass_line !== undefined && <Stat label={t("hero.pass_line")} value={formatScore(forecast.pass_line)} />}
        <Stat label={t("hero.gap")} value={formatScore(forecast.gap)} tone="warning" />
      </StatGroup>
      <p className="my-3 text-small text-ink-secondary">
        {t("hero.basis", { amount: formatCount(data.evidence_count), confidence: t(`hero.confidence.${forecast.confidence}`) })}
      </p>
      <AiContent>
        <p>{t("hero.explanation")}</p>
      </AiContent>
    </Card>
  );
}

export function TimeBudget({ data }: { data: S05StartReport }) {
  const { t } = useTranslation("S05");
  const time = data.time;
  // feat:S05-05 目标日前可用量、所需量、覆盖比例及缺口全由接口提供。
  return (
    <Card title={t("time.title")}>
      <BarList
        label={t("time.title")}
        items={[
          {
            key: "available",
            label: t("time.available"),
            value: time.available_minutes,
            valueText: formatDuration(time.available_minutes),
            tone: "brand",
          },
          {
            key: "required",
            label: t("time.required"),
            value: time.required_minutes,
            valueText: formatDuration(time.required_minutes),
            tone: "warning",
          },
        ]}
      />
      <KeyValueList
        items={[
          { key: "buffer", label: t("time.buffer"), value: formatDuration(time.buffer_minutes) },
          { key: "unavailable", label: t("time.unavailable"), value: formatDays(time.unavailable_days) },
          { key: "coverage", label: t("time.coverage"), value: formatPercent(time.coverage_ratio) },
          { key: "shortfall", label: t("time.shortfall"), value: formatDuration(time.shortfall_minutes) },
        ]}
      />
      <p className="my-3 text-small text-ink-tertiary">{t("time.basis")}</p>
      <div className="flex flex-wrap gap-2">
        <Link className={buttonClass("secondary", "sm")} to={pathTo("S03")}>
          {t("time.adjust_time")}
        </Link>
        <a className={buttonClass("secondary", "sm")} href="#s05-scope">
          {t("time.adjust_scope")}
        </a>
        <Link className={buttonClass("secondary", "sm")} to={pathTo("S02")}>
          {t("time.adjust_goal")}
        </Link>
      </div>
    </Card>
  );
}

export function ReportMap({ data }: { data: S05StartReport }) {
  const { t } = useTranslation("S05");
  const navigate = useNavigate();
  const [tab, setTab] = useState<"grid" | "chapters">("grid");
  // feat:S05-02 全图方格；feat:S05-04 接口已排好序的薄弱章节。
  return (
    <Card
      title={t("map.title")}
      actions={
        <Link to={pathTo("S09")} className={buttonClass("ghost", "sm")}>
          {t("map.open")}
        </Link>
      }
    >
      <Tabs
        label={t("map.tabs")}
        items={[
          { key: "grid", label: t("map.grid") },
          { key: "chapters", label: t("map.chapters") },
        ]}
        value={tab}
        onChange={setTab}
      >
        {tab === "grid" ? (
          <>
            <MasteryGrid
              label={t("map.title")}
              cells={data.grid.map((cell) => ({
                id: cell.knowledge_point_id,
                name: cell.name,
                level: cell.level as MasteryRank,
                evidenceSufficient: cell.evidence_sufficient,
                inScope: cell.in_scope,
              }))}
              onSelect={(id) => void navigate(pathTo("S10", { kpId: id }))}
            />
            <p className="mt-3 text-small text-ink-tertiary">{t("map.note")}</p>
          </>
        ) : (
          <DataTable
            caption={t("map.chapters")}
            stackOnNarrow
            rows={data.chapters}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "chapter",
                header: t("map.chapter"),
                label: t("map.chapter"),
                render: (row) => (
                  <span>
                    {row.name}{" "}
                    {row.high_frequency && (
                      <Tag tone="warning" size="sm">
                        {t("map.high_frequency")}
                      </Tag>
                    )}
                  </span>
                ),
              },
              { key: "met", header: t("map.met"), label: t("map.met"), render: (row) => formatPercent(row.met_ratio) },
              {
                key: "unlearned",
                header: t("map.unlearned"),
                label: t("map.unlearned"),
                render: (row) => t("map.count", { amount: formatCount(row.unlearned_count) }),
              },
            ]}
          />
        )}
      </Tabs>
    </Card>
  );
}
export function Overview({ data }: { data: S05StartReport }) {
  return <Columns main={<TimeBudget data={data} />} aside={<ReportMap data={data} />} />;
}
