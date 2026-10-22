import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S34GrowthProfile } from "@exam-prep/contract";
import { formatCount, formatDate } from "@exam-prep/shared/format";
import { Card, Stat, StatGroup, Tag, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

// feat:S34-01 个人身份、会员状态与累积记录；数值只显示接口结果。
export function ProfileCard({ data }: { data: S34GrowthProfile }) {
  const { t } = useTranslation("S34");
  return (
    <Card
      title={data.user.display_name}
      meta={t(data.user.is_guest ? "profile.guest" : "profile.identity")}
      actions={
        <Link to={pathTo("S31")} className={buttonClass("secondary")}>
          {t("profile.membership")}
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 text-small text-ink-tertiary">
        <Tag tone="brand">{t(`profile.member.${data.member}`)}</Tag>
        <span>{t("profile.joined", { date: formatDate(data.joined_on, { year: true }) })}</span>
      </div>
      <StatGroup>
        {(["goals", "effective_weeks", "graduated_mistakes", "mastered_points"] as const).map((key) => (
          <Stat key={key} label={t(`stats.${key}`)} value={formatCount(data.stats[key])} />
        ))}
      </StatGroup>
    </Card>
  );
}

export function Shortcuts({ data }: { data: S34GrowthProfile }) {
  const { t } = useTranslation("S34");
  return (
    <Card title={t("shortcuts.title")}>
      <nav aria-label={t("shortcuts.title")} className="grid grid-cols-2 gap-3 @tablet:grid-cols-3">
        {data.shortcuts.map((item) => (
          <Link
            key={item.page}
            to={pathTo(item.page)}
            className="flex min-w-0 flex-col items-start gap-2 rounded-sm border border-line-soft bg-surface p-3 text-small text-ink-primary hover:bg-sunk focus-visible:outline-brand"
          >
            <strong>{t(`shortcuts.page.${item.page}`)}</strong>
            <Tag tone={item.status === "unread" ? "warning" : "neutral"} size="sm">
              {t(`shortcuts.status.${item.status}`, { n: formatCount(item.count) })}
            </Tag>
          </Link>
        ))}
      </nav>
    </Card>
  );
}
