import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S34Package } from "@exam-prep/contract";
import { formatCount, formatDate } from "@exam-prep/shared/format";
import { Button, Card, List, ListRow, Tag, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

// feat:S34-05 我创建与分享的学习包：审核状态、导入次数、更新与下架入口。
export function PackagesCard({ items }: { items: readonly S34Package[] }) {
  const { t } = useTranslation("S34");
  const toast = useToast();
  return (
    <Card
      title={t("packages.title")}
      meta={t("packages.hint")}
      actions={
        <Button size="sm" onClick={() => toast(t("soon.packages"))}>
          {t("packages.manage")}
        </Button>
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-small text-ink-tertiary">{t("packages.none")}</p>
          <Link className={buttonClass("secondary", "sm")} to={pathTo("S11")}>
            {t("packages.materials")}
          </Link>
        </div>
      ) : (
        <List>
          {items.map((item) => (
            <ListRow
              key={item.id}
              title={item.name}
              description={
                <span className="flex flex-col gap-1">
                  <span>{t("packages.imports", { n: formatCount(item.imports) })}</span>
                  <span>{t("packages.updated", { date: formatDate(item.updated_on) })}</span>
                </span>
              }
              trailing={
                <Tag size="sm" tone={item.status === "reviewing" ? "warning" : item.status === "published" ? "success" : "neutral"}>
                  {t(`packages.status.${item.status}`)}
                </Tag>
              }
              action={
                <div className="flex flex-wrap gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toast(t("soon.update"))}>
                    {t("packages.update")}
                  </Button>
                  {item.status === "published" && (
                    <Button variant="ghost" size="sm" onClick={() => toast(t("soon.withdraw"))}>
                      {t("packages.withdraw")}
                    </Button>
                  )}
                </div>
              }
            />
          ))}
        </List>
      )}
    </Card>
  );
}
