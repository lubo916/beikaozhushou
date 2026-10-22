import { useTranslation } from "react-i18next";
import type { S20Workspace, S20PointStatus } from "@exam-prep/contract";
import { formatDateTime } from "@exam-prep/shared/format";
import { AiContent, Button, Card, DataTable, Tag } from "@exam-prep/ui";

import type { InputMethod } from "./AnswerDialog.tsx";

const TONES = { hit: "success", partial: "warning", missed: "danger" } as const;
function Status({ status }: { status: S20PointStatus }) {
  const { t } = useTranslation("S20");
  return (
    <Tag tone={TONES[status]} size="sm">
      {t(`points.${status}`)}
    </Tag>
  );
}
export function FeedbackCards({ data, onInput }: { data: S20Workspace; onInput: (input: InputMethod) => void }) {
  const { t } = useTranslation("S20");
  const answer = data.submission;
  if (answer === null) return null;
  return (
    <div className="flex flex-col gap-4">
      <Card title={t("question.title")} meta={<Tag tone="brand">{t(`types.${answer.question_type}`)}</Tag>}>
        <div className="flex flex-col gap-3">
          <h3 className="font-medium">{answer.title}</h3>
          <p>{answer.prompt}</p>
          {/* feat:S20-02 已批改作答旁也提供三种新作答入口。 */}
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("draft.method")}>
            {(["keyboard", "photo", "voice"] as const).map((input) => (
              <Button key={input} size="sm" onClick={() => onInput(input)}>
                {t(`draft.${input}`)}
              </Button>
            ))}
          </div>
          <p className="text-small text-ink-tertiary">
            {t("question.submitted")}：{formatDateTime(answer.submitted_at, data.time_zone)}
          </p>
          <h3 className="font-medium">{t("question.original")}</h3>
          <p className="whitespace-pre-wrap">{answer.original}</p>
        </div>
      </Card>
      {/* feat:S20-07 逐句批注：引用接口提供的用户原句，AI 评语显式标记，复制时自动加标。 */}
      <Card title={t("annotation.title")} meta={t("annotation.description")}>
        <AiContent>
          <ol className="flex flex-col gap-4">
            {data.annotations.map((item) => (
              <li key={item.id} className="flex flex-col gap-2">
                <blockquote className="border-l border-line-strong pl-3">
                  <span className="ui-visually-hidden">{t("annotation.quote")}：</span>
                  {item.quote}
                </blockquote>
                <div>
                  <Status status={item.status} />
                </div>
                <p>{item.feedback}</p>
              </li>
            ))}
          </ol>
        </AiContent>
      </Card>
      {/* feat:S20-04 命中、部分命中、遗漏逐条列出，不由页面计算采分或正确率。 */}
      <Card title={t("points.title")} flush>
        <AiContent>
          <DataTable
            caption={t("points.title")}
            stackOnNarrow
            rows={data.points}
            rowKey={(row) => row.id}
            columns={[
              { key: "title", header: t("points.point"), label: t("points.point"), render: (row) => row.title },
              { key: "status", header: t("points.status"), label: t("points.status"), render: (row) => <Status status={row.status} /> },
              { key: "feedback", header: t("points.feedback"), label: t("points.feedback"), render: (row) => row.feedback },
            ]}
          />
        </AiContent>
      </Card>
    </div>
  );
}
