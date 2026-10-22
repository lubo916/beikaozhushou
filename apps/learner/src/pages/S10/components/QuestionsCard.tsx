// 关联题目表：题目或题组、来源（题目可信度）、我的状态；可以直接去练，也可以在这里补题。
import { useTranslation } from "react-i18next";
import type { S10RelatedQuestion } from "@exam-prep/contract";
import { credibilityLabel } from "@exam-prep/shared/vocab";
import { Button, Card, DataTable, Tag, type TableColumn } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";

export function QuestionsCard({ questions }: { questions: readonly S10RelatedQuestion[] }) {
  const { t } = useTranslation("S10");
  const toast = useToast();
  const titleOf = (row: S10RelatedQuestion): string => {
    if (row.kind === "variant_group") return t("questions.variant_group", { n: row.count ?? 0 });
    if (row.kind === "past_group") return t("questions.past_group", { n: row.count ?? 0 });
    return row.title;
  };
  const statusOf = (row: S10RelatedQuestion): string =>
    row.status === "untried" ? t("questions.untried") : t(`questions.${row.status}`, { n: row.times });
  const columns: readonly TableColumn<S10RelatedQuestion>[] = [
    {
      key: "title",
      header: t("questions.col_title"),
      label: t("questions.col_title"),
      render: (row) => <span className="line-clamp-2">{titleOf(row)}</span>,
    },
    {
      key: "source",
      header: t("questions.col_source"),
      label: t("questions.col_source"),
      render: (row) => (
        <Tag size="sm" tone={row.credibility === "reviewed" ? "success" : "outline"}>
          {credibilityLabel(row.credibility)}
        </Tag>
      ),
    },
    {
      key: "status",
      header: t("questions.col_status"),
      label: t("questions.col_status"),
      render: (row) => <span className="whitespace-nowrap tabular-nums">{statusOf(row)}</span>,
    },
  ];
  return (
    <Card
      title={t("questions.title")}
      actions={
        // feat:S10-07 三板块：关联的题目、卡片、笔记都能在这里直接补
        <Button variant="ghost" size="sm" onClick={() => toast(t("soon.add_question"))}>
          {t("questions.add")}
        </Button>
      }
      footer={
        questions.length > 0 ? (
          <Button variant="primary" size="sm" onClick={() => toast(t("soon.practice"))}>
            {t("questions.practice")}
          </Button>
        ) : undefined
      }
    >
      {/* feat:S10-12 关联题目与变式：顺序由接口排好（我做错的、我没做过的、高频的）；变式只取审定题池或个人题库 */}
      <DataTable
        caption={t("questions.caption")}
        columns={columns}
        rows={questions}
        rowKey={(row) => row.id}
        empty={t("questions.none")}
        stackOnNarrow
      />
    </Card>
  );
}
