import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { P07DraftSegment, P07Pipeline, P07ReviewItem } from "@exam-prep/contract";
import { formatCount, formatDateTime, formatPercent } from "@exam-prep/shared";
import { AiContent, Button, Card, FilterChips, List, PageState, Tag, type FilterChipOption } from "@exam-prep/ui";
import { KINDS, type KindFilter } from "../data.ts";

interface ReviewDeskProps {
  readonly data: P07Pipeline;
  readonly kind: KindFilter;
  readonly onKind: (kind: KindFilter) => void;
  readonly onSoon: () => void;
}

/** AI 草稿：与原文一致的照常显示，AI 补写或改写的部分高亮（分段由接口给，页面不做比对）。 */
function Draft({ segments }: { segments: readonly P07DraftSegment[] }) {
  const { t } = useTranslation("P07");
  return (
    <p>
      {segments.map((segment, index) =>
        segment.change === "same" ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <mark key={index} className="rounded-sm bg-status-warning-soft px-1 text-ink-primary">
            <span className="ui-visually-hidden">{t(`review.change.${segment.change}`)}</span>
            {segment.text}
          </mark>
        ),
      )}
    </p>
  );
}

function ReviewDetail({ item, timeZone, onSoon }: { item: P07ReviewItem; timeZone: string; onSoon: () => void }) {
  const { t } = useTranslation("P07");
  return (
    <article aria-label={item.title} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{item.title}</strong>
        <Tag size="sm" tone="outline">
          {t(`review.kinds.${item.kind}`)}
        </Tag>
        {item.confidence !== undefined && (
          <Tag size="sm" tone="brand">
            {t("review.confidence", { value: formatPercent(item.confidence) })}
          </Tag>
        )}
      </div>
      <p className="text-small text-ink-tertiary">
        {t("review.meta", { point: item.knowledge_point, time: formatDateTime(item.queued_at, timeZone) })}
      </p>
      <div className="grid gap-3 @tablet:grid-cols-2">
        <section aria-label={t("review.source")} className="flex flex-col gap-2 rounded-md bg-bg-sunk p-3">
          <h3 className="text-small text-ink-secondary">{t("review.source")}</h3>
          <p>{item.source_text}</p>
        </section>
        {/* feat:P07-04 生成内容标识：AI 草稿一律带显式标识，从这里复制出去的文字开头带“AI 生成” */}
        {item.ai_generated ? (
          <AiContent note={t("review.draft")}>
            <Draft segments={item.draft} />
          </AiContent>
        ) : (
          <section aria-label={t("review.manual")} className="flex flex-col gap-2 rounded-md bg-bg-sunk p-3">
            <h3 className="text-small text-ink-secondary">{t("review.manual")}</h3>
            <Draft segments={item.draft} />
          </section>
        )}
      </div>
      <p className="text-small text-ink-tertiary">{t("review.diffHint")}</p>
      {/* 写操作还没有后端与权限登记：点了提示“即将上线”（F08-Q4） */}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={onSoon}>
          {t("review.approve")}
        </Button>
        <Button size="sm" onClick={onSoon}>
          {t("review.edit")}
        </Button>
        <Button size="sm" onClick={onSoon}>
          {t("review.reject")}
        </Button>
      </div>
    </article>
  );
}

// feat:P07-03 审核工作台：接口按置信度排好序（校准样本不足时按入队时间），原文与 AI 草稿并排，AI 补写、改写的部分高亮。
// 数据不足只和置信度排序有关，所以只在这张卡片里提示（F08-Q1）。
export function ReviewDesk({ data, kind, onKind, onSoon }: ReviewDeskProps) {
  const { t } = useTranslation("P07");
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const review = data.review;
  const current = review.items.find((item) => item.id === picked) ?? review.items[0];
  const rest = review.items.filter((item) => item !== current);
  const options: FilterChipOption<KindFilter>[] = [
    { value: "all", label: t("review.kinds.all") },
    ...KINDS.map((value) => ({ value, label: t(`review.kinds.${value}`), count: review.kind_counts[value] })),
  ];
  return (
    <Card title={t("review.title")} meta={review.sort === "confidence" ? t("review.sortConfidence") : t("review.sortQueued")}>
      <div className="flex flex-col gap-3">
        <FilterChips
          label={t("review.filter")}
          options={options}
          selected={[kind]}
          multiple={false}
          onChange={(next) => onKind(next[0] ?? "all")}
        />
        <p className="text-small text-ink-tertiary">{t("review.total", { n: formatCount(review.total_count) })}</p>
        {!data.sample_sufficient && (
          <PageState
            compact
            state="insufficient_data"
            title={t("state.insufficient_data.title")}
            body={t("state.insufficient_data.body")}
            counts={[
              { key: "sample", label: t("insufficient.sample"), value: t("items", { n: formatCount(data.sample_count) }) },
              { key: "minimum", label: t("insufficient.minimum"), value: t("items", { n: formatCount(data.minimum_sample_size) }) },
            ]}
            missing={t("insufficient.missing")}
          />
        )}
        {current === undefined ? (
          <p className="text-small text-ink-tertiary">{t("review.none")}</p>
        ) : (
          <ReviewDetail item={current} timeZone={data.time_zone} onSoon={onSoon} />
        )}
        {rest.length > 0 && (
          <List aria-label={t("review.queue")}>
            {rest.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="flex flex-col gap-1">
                  <strong>{item.title}</strong>
                  <span className="text-small text-ink-tertiary">
                    {t(`review.kinds.${item.kind}`)}
                    {t("review.separator")}
                    {item.confidence === undefined
                      ? t("review.queuedAt", { time: formatDateTime(item.queued_at, data.time_zone) })
                      : t("review.confidence", { value: formatPercent(item.confidence) })}
                  </span>
                </span>
                <Button size="sm" onClick={() => setPicked(item.id)}>
                  {t("review.open")}
                </Button>
              </li>
            ))}
          </List>
        )}
      </div>
    </Card>
  );
}
