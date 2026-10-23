import { useTranslation } from "react-i18next";
import type { P08CheckResult, P08GeneratedCheck } from "@exam-prep/contract";
import { vocabLabel } from "@exam-prep/shared";
import { AiContent, Card, List, Tag, type TagTone } from "@exam-prep/ui";

const OUTCOME_TONE: Readonly<Record<P08CheckResult["outcome"], TagTone>> = { pass: "success", warn: "warning", fail: "danger" };

// feat:P08-02 生成题七道质检：七项结果与证据上限都由接口给；同一套质检也用于学员侧即时生成的题。AI 的质检说明带 AI 标识。
export function QualityChecksCard({ checks }: { checks: readonly P08GeneratedCheck[] }) {
  const { t } = useTranslation("P08");
  return (
    <Card title={t("checks.title")} meta={t("checks.meta")} footer={<p className="text-small text-ink-tertiary">{t("checks.footer")}</p>}>
      {checks.length === 0 ? (
        <p className="text-small text-ink-tertiary">{t("checks.none")}</p>
      ) : (
        <List>
          {checks.map((check) => (
            <li key={check.id} className="flex flex-col gap-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{check.question_ref}</strong>
                <Tag size="sm" tone="outline">
                  {t(`checks.scopes.${check.scope}`)}
                </Tag>
                <Tag size="sm" tone="brand">
                  {t("checks.cap", { level: vocabLabel("evidence_strength", check.evidence_cap) })}
                </Tag>
              </div>
              <span className="text-small text-ink-secondary">{check.stem}</span>
              <ul aria-label={t("checks.items")} className="grid gap-2 @tablet:grid-cols-2">
                {check.results.map((result) => (
                  <li key={result.check} className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-1">
                      <Tag size="sm" tone={OUTCOME_TONE[result.outcome]}>
                        {t(`checks.outcomes.${result.outcome}`)}
                      </Tag>
                      {t(`checks.names.${result.check}`)}
                    </span>
                    {result.ai_note !== undefined && <AiContent>{result.ai_note}</AiContent>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </List>
      )}
    </Card>
  );
}
