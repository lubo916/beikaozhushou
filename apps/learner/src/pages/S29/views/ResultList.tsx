import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S29ResultGroup } from "@exam-prep/contract";
import { formatNumber } from "@exam-prep/shared/format";
import { AiBadge, Button, Tag } from "@exam-prep/ui";
import { resultPath } from "../routing.ts";
export function ResultList({ groups, onAction }: { groups: S29ResultGroup[]; onAction: (action: string) => void }) {
  const { t } = useTranslation("S29");
  // feat:S29-02 分组展示六种结果，导师回答显式带 AI 标识。
  // feat:S29-06 结果旁可加入今日、制卡、记笔记，未登记写权限时提示即将上线。
  return (
    <div className="s29-results">
      {groups.map((group) => (
        <section key={group.kind} aria-label={t(`kind.${group.kind}`)}>
          <h2>{t("results.group_count", { kind: t(`kind.${group.kind}`), total: formatNumber(group.count, 0) })}</h2>
          <ul>
            {group.items.map((item) => (
              <li key={item.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Tag>{t(`kind.${item.kind}`)}</Tag>
                  {item.ai_generated && <AiBadge />}
                </div>
                <Link className="s29-result-title" to={resultPath(item)} aria-label={t("results.open", { title: item.title })}>
                  {item.title}
                </Link>
                <p>{item.excerpt}</p>
                <p className="s29-hint">{t("results.source", { source: item.source })}</p>
                <div className="flex flex-wrap gap-2">
                  {["add", "card", "note"].map((action) => (
                    <Button size="sm" key={action} onClick={() => onAction(t(`results.${action}`))}>
                      {t(`results.${action}`)}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
