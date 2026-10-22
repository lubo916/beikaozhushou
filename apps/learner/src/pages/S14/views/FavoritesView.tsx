import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S14Favorite } from "@exam-prep/contract";
import { AiContent, Button, Card, FilterChips, buttonClass } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { pathTo } from "../../../routes.ts";

// feat:S14-09 四类收藏统一管理；组卷权限尚未登记，保留清晰动作反馈。
export function FavoritesView({ items }: { items: S14Favorite[] }) {
  const { t } = useTranslation("S14");
  const toast = useToast();
  const [kind, setKind] = useState("all");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{t("favorites.title")}</h2>
          <p className="text-small text-ink-secondary">{t("favorites.description")}</p>
        </div>
        <Button onClick={() => toast(t("soon"))}>{t("actions.createExam")}</Button>
      </div>
      <FilterChips
        label={t("favorites.title")}
        selected={[kind]}
        multiple={false}
        onChange={(values) => setKind(values[0] ?? "all")}
        options={["all", "question", "paragraph", "explanation", "note"].map((value) => ({ value, label: t(`favorites.kind.${value}`) }))}
      />
      {items
        .filter((item) => kind === "all" || item.kind === kind)
        .map((item) => (
          <Card
            key={item.id}
            title={item.title}
            meta={t(`favorites.kind.${item.kind}`)}
            footer={
              <Link
                className={buttonClass("ghost", "sm")}
                to={pathTo(
                  item.kind === "question" ? "S17" : item.kind === "paragraph" ? "S12" : item.kind === "explanation" ? "S28" : "S14",
                )}
              >
                {t("actions.reader")}
              </Link>
            }
          >
            <p className="mb-2 text-small text-ink-tertiary">{item.point_path}</p>
            {item.ai_generated ? (
              <AiContent>
                <p>{item.excerpt}</p>
              </AiContent>
            ) : (
              <p>{item.excerpt}</p>
            )}
          </Card>
        ))}
    </div>
  );
}
