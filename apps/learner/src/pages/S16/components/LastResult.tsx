import { useTranslation } from "react-i18next";
import type { S16Training } from "@exam-prep/contract";
import { formatNumber, formatPercent } from "@exam-prep/shared/format";
import { AiContent, Card, KeyValueList, PageState, Tag } from "@exam-prep/ui";

export function LastResult({ data }: { data: S16Training }) {
  const { t } = useTranslation("S16");
  const last = data.last_result;
  const body = (
    <div className="flex flex-col gap-3">
      <p className="text-small text-ink-tertiary">{t("last.hint")}</p>
      <Tag tone="success">{t(`grade.${last.grade}`)}</Tag>
      <KeyValueList
        items={[
          { key: "coverage", label: t("last.coverage"), value: formatPercent(last.coverage) },
          { key: "accuracy", label: t("last.accuracy"), value: formatPercent(last.accuracy) },
          ...(last.order === undefined ? [] : [{ key: "order", label: t("last.order"), value: formatPercent(last.order) }]),
        ]}
      />
      {last.order === undefined && (
        <PageState
          state="insufficient_data"
          title={t("state.insufficient.title")}
          body={t("state.insufficient.body", { value: formatNumber(data.order_min_samples, 0) })}
        />
      )}
      <p className="text-small text-ink-tertiary">{t("last.samples", { value: formatNumber(last.oral_samples, 0) })}</p>
      <div>
        <h3 className="font-bold">{t("last.missing")}</h3>
        {last.missing.length === 0 ? (
          <p>{t("last.noMissing")}</p>
        ) : (
          <ul className="list-disc pl-5 text-ink-secondary">
            {last.missing.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
  // feat:S16-05 覆盖、关键词、顺序与漏项只展示接口历史示例，不对本次输入计算分数。
  return (
    <Card title={t("last.title")} data-testid="s16-result">
      {last.ai_generated ? <AiContent>{body}</AiContent> : body}
    </Card>
  );
}
