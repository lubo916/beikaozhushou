import { useTranslation } from "react-i18next";
import type { S02ExamChoice } from "@exam-prep/contract";
import { formatDate, formatDuration, formatScore } from "@exam-prep/shared/format";
import { AiContent, Button, Card, KeyValueList, Tag } from "@exam-prep/ui";

/** 宽屏保留原型的右侧画像预览，确认时仍打开逐项核对面板。 */
export function SelectionSummary({ choice, onChoose, offline }: { choice: S02ExamChoice; onChoose: () => void; offline: boolean }) {
  const { t } = useTranslation("S02");
  return (
    <div className="hidden @content-md:block">
      <Card
        title={t("summary.title")}
        meta={t("summary.body")}
        footer={
          <Button variant="primary" onClick={onChoose} disabled={offline}>
            {t("summary.confirm")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <KeyValueList
            items={[
              { key: "name", label: t("profile.name"), value: choice.name },
              { key: "subject", label: t("profile.subject"), value: choice.profile.structure.map((subject) => subject.subject).join("、") },
              {
                key: "date",
                label: t("profile.date"),
                value: (
                  <>
                    {formatDate(choice.target_date, { year: true })}{" "}
                    {choice.estimated && <Tag tone="warning">{t("profile.estimated")}</Tag>}
                    <p className="mt-1 text-small text-ink-tertiary">{choice.date_basis}</p>
                  </>
                ),
              },
              { key: "rule", label: t("profile.rule"), value: t(`rule.${choice.profile.evaluation_rule.type}`) },
              {
                key: "score",
                label: t("profile.score"),
                value: (
                  <>
                    <strong className="text-brand-primary">{formatScore(choice.target_score)}</strong>
                    <p className="mt-1 text-small text-ink-tertiary">{choice.target_basis}</p>
                  </>
                ),
              },
              {
                key: "duration",
                label: t("summary.duration"),
                value: choice.profile.duration_minutes ? formatDuration(choice.profile.duration_minutes) : choice.form,
              },
              {
                key: "ready",
                label: t("catalog.readiness"),
                value: <Tag tone={choice.readiness === "complete" ? "success" : "warning"}>{t(`readiness.${choice.readiness}`)}</Tag>,
              },
            ]}
          />
          <AiContent note={t("profile.assessment")}>
            <p>{choice.assessment}</p>
          </AiContent>
        </div>
      </Card>
    </div>
  );
}
