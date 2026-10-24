import { useTranslation } from "react-i18next";
import type { P05ExamAnalysis, P05PastQuestion } from "@exam-prep/contract";
import { formatCount, formatPercent } from "@exam-prep/shared";
import { vocabLabel } from "@exam-prep/shared/vocab";
import { AiContent, Button, Card, DataTable, Tag, type TableColumn, type TagTone } from "@exam-prep/ui";

const SOURCE_TONE: Readonly<Record<P05PastQuestion["source"], TagTone>> = {
  official_public: "brand",
  licensed: "success",
  recalled: "warning",
};
const REVIEW_TONE: Readonly<Record<P05PastQuestion["review_status"], TagTone>> = { reviewed: "success", pending: "warning" };

interface QuestionTableProps {
  readonly data: P05ExamAnalysis;
  /** 确认关联要后端与权限，先提示“即将上线”。 */
  readonly onConfirm: () => void;
}

// 真题拆解：一题一行；拆解与干扰项标注的 AI 初稿带 AI 标识，经教研审核后发布。
export function QuestionTable({ data, onConfirm }: QuestionTableProps) {
  const { t } = useTranslation("P05");
  const header = (key: string) => t(`questions.columns.${key}`);
  const columns: readonly TableColumn<P05PastQuestion>[] = [
    {
      key: "question",
      header: header("question"),
      label: header("question"),
      render: (row) => (
        <div className="flex flex-col gap-1">
          <strong>{t("questions.label", { year: row.year, subject: row.subject, number: row.number })}</strong>
          {/* feat:P05-01 真题入库：按官方公开、授权、回忆版三级标注来源 */}
          <span>
            <Tag size="sm" tone={SOURCE_TONE[row.source]}>
              {t(`sources.${row.source}`)}
            </Tag>
          </span>
        </div>
      ),
    },
    {
      key: "point",
      header: header("point"),
      label: header("point"),
      // feat:P05-02 题与知识点自动关联：置信度由接口给，人工确认。
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span>{row.knowledge_point.name}</span>
          <span className="text-small text-ink-tertiary">
            {t("questions.confidence", { value: formatPercent(row.knowledge_point.confidence) })}
          </span>
          <span>
            {row.knowledge_point.status === "confirmed" ? (
              <Tag size="sm" tone="success">
                {t("link.confirmed")}
              </Tag>
            ) : (
              <Button size="sm" onClick={onConfirm}>
                {t("link.confirm")}
              </Button>
            )}
          </span>
        </div>
      ),
    },
    {
      key: "distractors",
      header: header("distractors"),
      label: header("distractors"),
      // feat:P05-03 选项级解构：标出每个错项的干扰模式（叫法取统一词汇“陷阱类型”）。
      render: (row) => {
        const text = row.distractors
          .map((note) => t("questions.distractor", { option: note.option, trap: vocabLabel("trap_type", note.trap) }))
          .join(t("questions.separator"));
        return row.ai_draft ? <AiContent note={t("questions.aiNote")}>{text}</AiContent> : <span>{text}</span>;
      },
    },
    {
      key: "status",
      header: header("status"),
      label: header("status"),
      render: (row) => (
        <Tag size="sm" tone={REVIEW_TONE[row.review_status]}>
          {t(`review.${row.review_status}`)}
        </Tag>
      ),
    },
  ];
  return (
    <Card title={t("questions.title")}>
      <div className="flex flex-col gap-3">
        <p className="text-small text-ink-secondary">{t("questions.summary", { n: formatCount(data.total_count) })}</p>
        <DataTable
          caption={t("questions.caption")}
          columns={columns}
          rows={data.questions}
          rowKey={(row) => row.question_id}
          stackOnNarrow
        />
      </div>
    </Card>
  );
}
