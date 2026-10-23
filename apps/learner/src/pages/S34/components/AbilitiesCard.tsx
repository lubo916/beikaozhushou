import { useTranslation } from "react-i18next";
import type { S34Ability, S34Comparison } from "@exam-prep/contract";
import { formatCount, formatPercent } from "@exam-prep/shared/format";
import { BarList, Card, DataTable, PageState } from "@exam-prep/ui";

// feat:S34-04 跨考试的知识与技能分布，覆盖率只来自接口。
export function AbilitiesCard({ items, comparison }: { items: readonly S34Ability[]; comparison: S34Comparison }) {
  const { t } = useTranslation("S34");
  return (
    <Card title={t("abilities.title")} meta={t("abilities.hint")}>
      {items.length === 0 ? (
        <p className="text-small text-ink-tertiary">{t("abilities.none")}</p>
      ) : (
        <BarList
          label={t("abilities.label")}
          max={1}
          items={items.map((item) => ({
            key: item.id,
            label: (
              <span>
                {item.name}
                <span className="block text-small text-ink-tertiary">{item.scope}</span>
              </span>
            ),
            value: item.coverage,
            valueText: formatPercent(item.coverage),
            tone: "brand",
          }))}
        />
      )}
      <div className="mt-4 border-t border-line-soft pt-4">
        {comparison.available ? (
          <>
            <h3 className="mb-2 font-medium text-ink-primary">{t("comparison.title")}</h3>
            <p className="mb-3 text-small text-ink-tertiary">{t("comparison.attempts", { n: formatCount(comparison.attempts) })}</p>
            <DataTable
              caption={t("comparison.caption")}
              rows={comparison.items}
              rowKey={(row) => row.name}
              columns={[
                { key: "name", header: t("comparison.title"), render: (row) => row.name },
                { key: "previous", header: t("comparison.previous"), render: (row) => formatCount(row.previous) },
                { key: "current", header: t("comparison.current"), render: (row) => formatCount(row.current) },
              ]}
            />
          </>
        ) : (
          <PageState
            compact
            state="insufficient_data"
            title={t("state.insufficient.title")}
            body={t("state.insufficient.body")}
            counts={[{ key: "attempts", label: t("comparison.count_label"), value: formatCount(comparison.attempts) }]}
            missing={t("state.insufficient.count", { n: formatCount(comparison.attempts) })}
          />
        )}
      </div>
    </Card>
  );
}
