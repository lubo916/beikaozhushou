// feat:S10-05 多源资料定位：教材的节、纸书页码、外部课讲次、视频时刻；可解析的点进阅读器。接入方式三种，“平台授权”是来源标签（勘误表第 17 条）。
import { useTranslation } from "react-i18next";
import type { S10Location, S10MaterialSpot } from "@exam-prep/contract";
import { formatDuration, formatSeconds } from "@exam-prep/shared/format";
import { VOCAB } from "@exam-prep/shared/vocab";
import { Card, List, ListRow, Tag } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

export function MaterialsCard({ materials }: { materials: readonly S10MaterialSpot[] }) {
  const { t } = useTranslation("S10");
  const where = (location: S10Location | undefined): string | undefined => {
    if (location === undefined) return undefined;
    if (location.kind === "section") {
      const section = location.section ?? "";
      return location.minutes === undefined
        ? t("materials.section", { section })
        : t("materials.section_minutes", { section, duration: formatDuration(location.minutes) });
    }
    if (location.kind === "pages") return t("materials.pages", { from: location.page_from ?? "", to: location.page_to ?? "" });
    const time = formatSeconds(location.start_seconds ?? 0);
    if (location.kind === "lecture") return t("materials.lecture", { lecture: location.lecture ?? "", time });
    return t("materials.video", { time });
  };
  return (
    <Card title={t("materials.title")}>
      {materials.length === 0 ? (
        <p className="text-small text-ink-tertiary">{t("materials.none")}</p>
      ) : (
        <List>
          {materials.map((spot) => (
            <ListRow
              key={spot.id}
              title={spot.title}
              description={where(spot.location)}
              href={spot.access === "parsable" ? pathTo("S12", { docId: spot.id }) : undefined}
              trailing={
                <span className="flex flex-wrap justify-end gap-1">
                  {spot.licensed && (
                    <Tag size="sm" tone="brand">
                      {t("materials.licensed")}
                    </Tag>
                  )}
                  <Tag size="sm" tone="outline">
                    {VOCAB.material[spot.access]}
                  </Tag>
                </span>
              }
            />
          ))}
        </List>
      )}
    </Card>
  );
}
