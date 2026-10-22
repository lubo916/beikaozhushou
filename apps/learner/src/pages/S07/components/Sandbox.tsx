import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S07PlanOverview } from "@exam-prep/contract";
import { formatPercent, formatRange } from "@exam-prep/shared/format";
import { AiBadge, Banner, Button, Drawer, ProposalCard, Stat, StatGroup, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

// feat:S07-13 feat:S07-16 沙盘仅展示接口预设的试算结果；未经确认不改计划。
export function Sandbox({ data, open, onClose, soon }: { data: S07PlanOverview; open: boolean; onClose: () => void; soon: () => void }) {
  const { t } = useTranslation("S07");
  const [preset, setPreset] = useState(data.sandbox[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [calculated, setCalculated] = useState(false);
  const scenario = data.sandbox.find((item) => item.id === preset);
  return (
    <Drawer open={open} onClose={onClose} title={t("sandbox.title")}>
      <div className="flex flex-col gap-4">
        <p className="text-ink-secondary">{t("sandbox.description")}</p>
        <label className="s07-field">
          {t("sandbox.preset")}
          <select
            value={preset}
            onChange={(event) => {
              setPreset(event.target.value);
              setCalculated(false);
            }}
          >
            {data.sandbox.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="s07-field">
          {t("sandbox.input")}
          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setCalculated(false);
            }}
            placeholder={t("sandbox.placeholder")}
          />
        </label>
        <p className="text-small text-ink-secondary">{t("sandbox.hint")}</p>
        <Button variant="primary" onClick={() => setCalculated(true)} disabled={scenario === undefined}>
          {t("sandbox.calculate")}
        </Button>
        {calculated && scenario !== undefined && (
          <section className="flex flex-col gap-4" aria-label={t("sandbox.preview")}>
            <h3 className="font-medium">{t("sandbox.preview")}</h3>
            <AiBadge />
            <p>{scenario.description}</p>
            {data.forecast_available ? (
              <StatGroup>
                <Stat label={t("sandbox.forecast")} value={formatRange(scenario.forecast_low, scenario.forecast_high, t("scoreUnit"))} />
                <Stat label={t("sandbox.completion")} value={formatPercent(scenario.completion)} />
              </StatGroup>
            ) : (
              <Banner
                tone="warning"
                title={t("sandbox.locked")}
                action={
                  <Link to={pathTo("S09")} className={buttonClass("secondary")}>
                    {t("sandbox.repair")}
                  </Link>
                }
              />
            )}
            <p>
              {t("sandbox.cost")}：{scenario.cost}
            </p>
            <ProposalCard
              status={scenario.proposal.status}
              what={scenario.proposal.change}
              why={scenario.proposal.reason}
              cost={scenario.proposal.cost}
              ifNot={scenario.proposal.if_declined}
              aiGenerated
              onConfirm={soon}
              onDecline={soon}
            />
            <Button variant="primary" onClick={soon}>
              {t("sandbox.adopt")}
            </Button>
            <p className="text-small text-ink-secondary">{t("sandbox.noChange")}</p>
          </section>
        )}
      </div>
    </Drawer>
  );
}
