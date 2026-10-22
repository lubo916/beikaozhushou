// feat:S10-06 我的掌握证据：最近的作答、回忆、用时、把握度，以及档位是怎么算出来的。证据行用公共组件 EvidenceRow。
import { useTranslation } from "react-i18next";
import type { S10Evidence, S10EvidenceItem } from "@exam-prep/contract";
import { formatDate, formatSeconds } from "@exam-prep/shared/format";
import type { ConfidenceCode } from "@exam-prep/shared/vocab";
import { Button, Card, EvidenceRow, List } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

/** 学员关闭了把握度（off）时不显示把握度。 */
function confidenceOf(item: S10EvidenceItem): ConfidenceCode | undefined {
  return item.confidence === undefined || item.confidence === "off" ? undefined : item.confidence;
}

export function EvidenceCard({ evidence }: { evidence: S10Evidence }) {
  const { t } = useTranslation("S10");
  const toast = useToast();
  const kindOf = (item: S10EvidenceItem): string => {
    const kind = t(`evidence.kind.${item.kind}`);
    return item.interval_days === undefined ? kind : `${kind} · ${t("evidence.interval", { days: item.interval_days })}`;
  };
  const noteOf = (item: S10EvidenceItem): string | undefined => {
    if (item.strength === "pending") return t("evidence.pending_note");
    if (item.in_mistakes === true) return t("evidence.mistake_note");
    return undefined;
  };
  return (
    <Card
      title={t("evidence.title")}
      meta={t("evidence.meta")}
      footer={
        evidence.total > evidence.items.length ? (
          <Button variant="ghost" size="sm" onClick={() => toast(t("soon.evidence_all"))}>
            {t("evidence.all", { total: evidence.total })}
          </Button>
        ) : undefined
      }
    >
      {evidence.items.length === 0 ? (
        <p className="text-small text-ink-tertiary">{t("evidence.none")}</p>
      ) : (
        <List>
          {evidence.items.map((item) => (
            <EvidenceRow
              key={item.id}
              when={formatDate(item.day)}
              title={item.subject}
              kind={kindOf(item)}
              result={item.result}
              confidence={confidenceOf(item)}
              duration={item.duration_seconds === undefined ? undefined : formatSeconds(item.duration_seconds)}
              strength={item.strength}
              credibility={item.credibility}
              note={noteOf(item)}
            />
          ))}
        </List>
      )}
      <p className="mt-3 text-small text-ink-tertiary">{t("evidence.how")}</p>
    </Card>
  );
}
