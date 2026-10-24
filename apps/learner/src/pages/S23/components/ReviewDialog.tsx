import { reviewQuestions } from "./review.ts";
import { useTranslation } from "react-i18next";
import type { S23AssessmentReport } from "@exam-prep/contract";
import { formatCount, formatScore, formatSeconds } from "@exam-prep/shared/format";
import { Button, Card, Dialog, KeyValueList, Tag } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import type { ReviewFilter } from "./DistributionCard.tsx";
export function ReviewDialog({
  report,
  filter,
  onClose,
}: {
  report: S23AssessmentReport;
  filter: ReviewFilter | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation("S23");
  const toast = useToast();
  const questions = reviewQuestions(report.questions, filter?.ids);
  // feat:S23-07 逐题复盘：原作答、用时、把握度、解析；记录只读，不能在揭晓后改答案。
  // feat:S23-06 主观题评分与 feat:S23-03 待归因入口：尚未接通写接口，明确提示即将上线。
  return (
    <Dialog
      open={filter !== undefined}
      onClose={onClose}
      title={t("review.title")}
      description={t("review.filtered", { filter: filter?.name ?? "" })}
      actions={<Button onClick={onClose}>{t("review.close")}</Button>}
    >
      <div className="flex flex-col gap-4">
        <p className="text-small text-ink-secondary">{t("review.sample_note")}</p>
        {questions.length === 0 && <p>{t("review.empty")}</p>}
        {questions.map((q) => (
          <Card
            key={q.id}
            title={t("review.number", { number: formatCount(q.number) })}
            headingLevel={3}
            meta={
              <Tag tone={q.pending_grading ? "warning" : q.correct ? "success" : "danger"}>
                {t(q.pending_grading ? "review.pending" : q.correct ? "review.correct" : "review.wrong")}
              </Tag>
            }
          >
            <p className="mb-3 font-medium">{q.title}</p>
            <KeyValueList
              items={[
                {
                  key: "answer",
                  label: t("review.answer"),
                  value:
                    q.answer.text ??
                    t("review.choice", { options: q.answer.selected?.map((x) => formatCount(x)).join("、") ?? t("review.none") }),
                },
                { key: "expected", label: t("review.expected"), value: q.expected_answer },
                {
                  key: "score",
                  label: t("review.score"),
                  value: q.pending_grading ? t("review.pending") : formatScore(q.score, { total: q.total }),
                },
                { key: "time", label: t("review.time"), value: formatSeconds(q.duration_seconds) },
                { key: "confidence", label: t("review.confidence"), value: t(`review.confidence_value.${q.confidence}`) },
                { key: "cause", label: t("review.cause"), value: q.error_cause || t(q.correct ? "review.none" : "review.unattributed") },
                { key: "trap", label: t("review.trap"), value: q.trap || t("review.none") },
              ]}
            />
            <h4 className="mt-3 font-medium">{t("review.analysis")}</h4>
            <p className="text-ink-secondary">{q.analysis}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {q.pending_grading && <Button onClick={() => toast(t("soon"))}>{t("review.grade")}</Button>}
              {!q.error_cause && q.correct === false && <Button onClick={() => toast(t("soon"))}>{t("review.attribute")}</Button>}
              <Button onClick={() => toast(t("soon"))}>{t("review.open")}</Button>
            </div>
          </Card>
        ))}
      </div>
    </Dialog>
  );
}
