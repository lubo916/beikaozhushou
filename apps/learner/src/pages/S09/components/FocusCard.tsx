// 选中的知识点（默认选中今日推荐的第一个；feat:S09-16 一键行动：从任意一格进入学、练、背或加入今日）。
// 去主页、背一背跳路由表里的页面；加入今日、练一练还没有后端，提示“即将上线”。
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { masteryLabel } from "@exam-prep/shared/vocab";
import { Button, Card, KpCard, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";
import { toRank, type Located } from "../data.ts";

export interface FocusCardProps {
  readonly focus: Located | undefined;
  /** 是学员刚点选的（否则是默认选中的今日推荐）。 */
  readonly picked: boolean;
  readonly className?: string;
}

export function FocusCard({ focus, picked, className }: FocusCardProps) {
  const { t } = useTranslation("S09");
  const toast = useToast();
  if (focus === undefined) {
    return (
      <Card title={t("focus.title")} className={className}>
        <p className="s09-note">{t("focus.none")}</p>
      </Card>
    );
  }
  const { point, chapter } = focus;
  const home = pathTo("S10", { kpId: point.id });
  return (
    <Card title={t("focus.title")} meta={picked ? t("focus.picked") : t("focus.default")} className={className}>
      {point.target_level !== undefined && point.gap !== undefined ? (
        <KpCard
          name={point.name}
          path={chapter.name}
          system={toRank(point.level)}
          target={toRank(point.target_level)}
          gap={point.gap}
          evidenceSufficient={point.evidence_sufficient}
          importance={point.importance}
          types={point.knowledge_types}
          scope={point.in_scope ? undefined : "removed"}
        />
      ) : (
        <div className="s09-stack s09-stack--tight">
          <p className="s09-focus__name">{point.name}</p>
          <p className="s09-note">{t("focus.target_none", { level: masteryLabel(toRank(point.level)) })}</p>
        </div>
      )}
      {point.self_level !== undefined && (
        <p className="s09-gap-top">
          <Tag tone="outline" size="sm">
            {t("focus.self", { level: masteryLabel(toRank(point.self_level)) })}
          </Tag>
        </p>
      )}
      <div className="s09-actions s09-gap-top">
        <Link to={home} className={buttonClass("secondary", "sm")}>
          {t("focus.open")}
        </Link>
        <Button size="sm" onClick={() => toast(t("soon.add_today"))}>
          {t("focus.add_today")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => toast(t("soon.practice"))}>
          {t("focus.practice")}
        </Button>
        <Link to={pathTo("S15")} className={buttonClass("ghost", "sm")}>
          {t("focus.review")}
        </Link>
      </div>
    </Card>
  );
}
