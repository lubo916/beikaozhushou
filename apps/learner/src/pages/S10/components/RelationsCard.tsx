// feat:S10-13 关联知识（P1）：按八类关系分组显示，强度高的在前（顺序由接口给）；点名字去那个知识点的主页。
// 导师建议的关系带 AI 标识，只是待采纳的提议（红线 3）；易混的可以对比（feat:S10-14）。
import { useTranslation } from "react-i18next";
import type { S10RelatedPoint, S10RelationType } from "@exam-prep/contract";
import { formatTierGap } from "@exam-prep/shared/format";
import { VOCAB } from "@exam-prep/shared/vocab";
import { AiBadge, Button, Card, List, ListRow, Tag } from "@exam-prep/ui";
import type { S10RelationGroup } from "@exam-prep/contract";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

function Origin({ item }: { item: S10RelatedPoint }) {
  const { t } = useTranslation("S10");
  if (item.origin !== "tutor") return <>{VOCAB.knowledge_map[item.origin]}</>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <AiBadge size="xs" />
      {item.pending ? t("relations.origin_tutor") : t("relations.origin_tutor_done")}
    </span>
  );
}

export function RelationsCard({ groups }: { groups: readonly S10RelationGroup[] }) {
  const { t } = useTranslation("S10");
  const toast = useToast();
  const rows = groups.flatMap((group) => group.items.map((item) => ({ type: group.type, item })));
  const actionOf = (type: S10RelationType, item: S10RelatedPoint) => {
    if (item.pending) {
      return (
        <Button size="sm" onClick={() => toast(t("soon.adopt"))}>
          {t("relations.adopt")}
        </Button>
      );
    }
    if (type === "confusable") {
      return (
        <Button size="sm" onClick={() => toast(t("soon.compare"))}>
          {t("relations.compare")}
        </Button>
      );
    }
    return undefined;
  };
  return (
    <Card title={t("relations.title")}>
      {rows.length === 0 ? (
        <p className="text-small text-ink-tertiary">{t("relations.none")}</p>
      ) : (
        <List>
          {rows.map(({ type, item }) => (
            <ListRow
              key={`${type}:${item.point_id ?? item.name}`}
              title={t("relations.item", { type: t(`relations.type.${type}`), name: item.name })}
              description={<Origin item={item} />}
              href={item.point_id === undefined ? undefined : pathTo("S10", { kpId: item.point_id })}
              trailing={
                item.gap === undefined ? undefined : (
                  <Tag size="sm" tone={item.gap <= 0 ? "success" : "warning"}>
                    {formatTierGap(item.gap)}
                  </Tag>
                )
              }
              action={actionOf(type, item)}
            />
          ))}
        </List>
      )}
    </Card>
  );
}
