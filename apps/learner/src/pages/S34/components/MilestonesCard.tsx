import { useTranslation } from "react-i18next";
import type { S34Milestone } from "@exam-prep/contract";
import { formatCount, formatDate } from "@exam-prep/shared/format";
import { Card, List, ListRow, Tag } from "@exam-prep/ui";

// feat:S34-03 只记录真实进步：错题毕业、知识点达标、阶段完成、模考过线、有效学习周。
export function MilestonesCard({ items }: { items: readonly S34Milestone[] }) {
  const { t } = useTranslation("S34");
  return (
    <Card title={t("milestones.title")} meta={t("milestones.hint")}>
      {items.length === 0 ? (
        <p className="text-small text-ink-tertiary">{t("milestones.none")}</p>
      ) : (
        <List>
          {items.map((item) => (
            <ListRow
              key={item.id}
              title={t(`milestones.kind.${item.kind}`, { n: formatCount(item.value) })}
              description={item.detail}
              trailing={
                <Tag tone="success" size="sm">
                  {formatDate(item.achieved_on)}
                </Tag>
              }
            />
          ))}
        </List>
      )}
    </Card>
  );
}
