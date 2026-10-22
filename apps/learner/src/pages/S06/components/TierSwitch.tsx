// feat:S06-09 三档降级：完整、精简、保底，保住连续性；剩下的任务换成哪一档、各要多少分钟由接口给。换档是写操作，接后端前提示“即将上线”。
import { useTranslation } from "react-i18next";
import type { S06Tiers } from "@exam-prep/contract";
import { formatDuration } from "@exam-prep/shared/format";
import { VOCAB } from "@exam-prep/shared/vocab";
import { Button } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export function TierSwitch({ tiers }: { tiers: S06Tiers }) {
  const { t } = useTranslation("S06");
  const toast = useToast();
  return (
    <div role="group" aria-label={t("list.tiers")} className="flex flex-wrap items-center gap-2">
      <span className="text-small text-ink-secondary">{t("list.tiers")}</span>
      {tiers.options.map((option) => {
        const current = option.tier === tiers.current;
        return (
          <Button
            key={option.tier}
            size="sm"
            variant={current ? "primary" : "secondary"}
            aria-pressed={current}
            onClick={() => {
              if (!current) toast(t("soon.tier"));
            }}
          >
            {t("list.tier", { tier: VOCAB.degrade_tier[option.tier], duration: formatDuration(option.minutes) })}
          </Button>
        );
      })}
    </div>
  );
}
