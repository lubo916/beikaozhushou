import { useTranslation } from "react-i18next";
import type { P07Production } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared";
import { AiBadge, Button, Card, List, Tag, type TagTone } from "@exam-prep/ui";

const STATUS_TONE: Readonly<Record<P07Production["status"], TagTone>> = {
  drafting: "ai",
  in_review: "warning",
  ready: "brand",
  published: "success",
};

// feat:P07-02 解析与卡片生产：分层解析与官方卡组，已审条数与状态由接口给；审核完才能发布（“发布”还没有后端，点了提示即将上线）。
// feat:P07-04 生成内容标识：AI 起草的带显式标识；发布与导出的文件里也带“AI 生成”文件标识。
export function ProductionsCard({ productions, onSoon }: { productions: readonly P07Production[]; onSoon: () => void }) {
  const { t } = useTranslation("P07");
  return (
    <Card title={t("productions.title")} footer={<p className="text-small text-ink-tertiary">{t("productions.footer")}</p>}>
      {productions.length === 0 ? (
        <p className="text-small text-ink-tertiary">{t("productions.none")}</p>
      ) : (
        <List>
          {productions.map((production) => (
            <li key={production.id} className="flex flex-col gap-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{production.title}</strong>
                {production.ai_generated && <AiBadge size="xs" />}
              </div>
              <div className="flex flex-wrap gap-1">
                <Tag size="sm" tone="outline">
                  {t(`productions.kinds.${production.kind}`)}
                </Tag>
                <Tag size="sm" tone={STATUS_TONE[production.status]}>
                  {t(`productions.status.${production.status}`)}
                </Tag>
                {production.ai_generated &&
                  (production.file_marked ? (
                    <Tag size="sm" tone="success">
                      {t("productions.fileMarked")}
                    </Tag>
                  ) : (
                    <Tag size="sm" tone="warning">
                      {t("productions.fileUnmarked")}
                    </Tag>
                  ))}
              </div>
              <span className="text-small text-ink-tertiary">
                {t("productions.reviewed", { reviewed: formatCount(production.reviewed_count), total: formatCount(production.item_count) })}
              </span>
              {production.status === "ready" && (
                <span>
                  <Button variant="primary" size="sm" onClick={onSoon}>
                    {t("productions.publish")}
                  </Button>
                </span>
              )}
            </li>
          ))}
        </List>
      )}
    </Card>
  );
}
