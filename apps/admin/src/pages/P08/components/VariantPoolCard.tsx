import { useTranslation } from "react-i18next";
import type { P08QuestionReview, P08VariantPool } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared";
import { Button, Card, DataTable, PageState, Tag, type TableColumn, type TagTone } from "@exam-prep/ui";

type Quality = NonNullable<P08VariantPool["quality"]>;
const QUALITY_TONE: Readonly<Record<Quality, TagTone>> = { good: "success", watch: "warning", poor: "danger" };

// feat:P08-03 变式题池管理：每道母题的变式数量、质量与曝光；质量结论要够数的作答样本，不够时只显示原始计数。
// 数据不足只和质量结论有关，所以只在这张卡片里提示（F08-Q1）。
export function VariantPoolCard({ data, onSoon }: { data: P08QuestionReview; onSoon: () => void }) {
  const { t } = useTranslation("P08");
  // 窄屏叠成小卡时，第一列（题号与题干）不带名称，当作小卡的标题（与原型手机版一致）。
  const columns: TableColumn<P08VariantPool>[] = [
    {
      key: "parent",
      header: t("variants.columns.parent"),
      render: (pool) => (
        <span className="flex flex-col gap-1">
          <strong>{pool.parent_ref}</strong>
          <span className="text-small text-ink-secondary">{pool.stem}</span>
        </span>
      ),
    },
    {
      key: "count",
      header: t("variants.columns.count"),
      label: t("variants.columns.count"),
      align: "end",
      render: (pool) => formatCount(pool.variant_count),
    },
    {
      key: "quality",
      header: t("variants.columns.quality"),
      label: t("variants.columns.quality"),
      render: (pool) =>
        pool.quality === undefined ? (
          <span className="text-small text-ink-tertiary">{t("variants.qualityPending")}</span>
        ) : (
          <Tag size="sm" tone={QUALITY_TONE[pool.quality]}>
            {t(`variants.quality.${pool.quality}`)}
          </Tag>
        ),
    },
    {
      key: "exposure",
      header: t("variants.columns.exposure"),
      label: t("variants.columns.exposure"),
      align: "end",
      render: (pool) => (
        <span className="flex flex-wrap items-center justify-end gap-1">
          {formatCount(pool.exposure_count)}
          {pool.exposure_level === "high" && (
            <Tag size="sm" tone="warning">
              {t("variants.exposureHigh")}
            </Tag>
          )}
        </span>
      ),
    },
    {
      key: "action",
      header: t("variants.columns.action"),
      label: t("variants.columns.action"),
      render: () => (
        <Button size="sm" onClick={onSoon}>
          {t("variants.manage")}
        </Button>
      ),
    },
  ];
  return (
    <Card title={t("variants.title")} meta={t("variants.meta")}>
      <div className="flex flex-col gap-3">
        {!data.sample_sufficient && (
          <PageState
            compact
            state="insufficient_data"
            title={t("state.insufficient_data.title")}
            body={t("state.insufficient_data.body")}
            counts={[
              { key: "sample", label: t("insufficient.sample"), value: t("times", { n: formatCount(data.sample_count) }) },
              { key: "minimum", label: t("insufficient.minimum"), value: t("times", { n: formatCount(data.minimum_sample_size) }) },
            ]}
            missing={t("insufficient.missing")}
          />
        )}
        <DataTable
          caption={t("variants.title")}
          columns={columns}
          rows={data.variant_pools}
          rowKey={(pool) => pool.id}
          stackOnNarrow
          empty={t("variants.none")}
        />
      </div>
    </Card>
  );
}
