import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { S20Workspace } from "@exam-prep/contract";
import { formatCount, formatRange, formatScore } from "@exam-prep/shared/format";
import { AiContent, Button, Card, PageState, Segmented, Stat, Tag, buttonClass } from "@exam-prep/ui";
import { pathTo } from "../../../routes.ts";

export type ScoringMethod = "mentor" | "self" | "none";
export function ScoringCards({
  data,
  method,
  onMethod,
}: {
  data: S20Workspace;
  method: ScoringMethod;
  onMethod: (method: ScoringMethod) => void;
}) {
  const { t } = useTranslation("S20");
  const score = data.score;
  return (
    <div className="flex flex-col gap-4">
      {/* feat:S20-03 三种方式用于新作答；待评分不计正确率，自评不自动换算分数。 */}
      <Card title={t("method.title")}>
        <div className="flex flex-col gap-3">
          <Segmented
            label={t("method.label")}
            className="flex-col"
            value={method}
            onChange={onMethod}
            options={["mentor", "self", "none"].map((value) => ({ value: value as ScoringMethod, label: t(`method.${value}`) }))}
          />
          <p>{t(`method.${method}Hint`)}</p>
          <p className="text-small text-ink-tertiary">{t("method.pending")}</p>
          <p className="text-small text-ink-tertiary">{t("method.preview")}</p>
        </div>
      </Card>
      {/* feat:S20-06 评分细则来源按接口展示，区分官方、模板作者、机构与参考答案提取。 */}
      <Card title={t("rubric.title")}>
        <div className="flex flex-col gap-2">
          <div>
            <Tag tone="outline">{t(`rubric.${data.rubric.source}`)}</Tag>
          </div>
          <p>{data.rubric.available ? data.rubric.title : t("rubric.unavailable")}</p>
        </div>
      </Card>
      {/* feat:S20-05 分数区间、把握度和独立评分次数均由接口给；受限、缺细则与低一致性时不给分。 */}
      <Card title={t("score.title")}>
        {method !== "mentor" ? (
          <p>{t(`score.${method}`)}</p>
        ) : data.availability === "restricted" ? (
          <PageState
            state="restricted"
            compact
            title={t("state.restricted.title")}
            body={t("state.restricted.body")}
            action={<Button onClick={() => onMethod("self")}>{t("state.restricted.action")}</Button>}
          />
        ) : !data.rubric.available ? (
          <PageState
            state="insufficient_data"
            compact
            title={t("state.insufficient_data.title")}
            body={t("state.insufficient_data.body")}
          />
        ) : !data.rubric.consistent || score === null ? (
          <p>{t("score.inconsistent")}</p>
        ) : (
          <AiContent>
            <div className="flex flex-col gap-2" data-testid="s20-score">
              <Stat
                label={t("score.range")}
                value={formatRange(score.low, score.high)}
                hint={t("score.full", { score: formatScore(score.full) })}
              />
              <p>{t("score.confidence", { value: t(`score.${score.confidence}`) })}</p>
              <p>{t("score.reviews", { reviews: formatCount(score.independent_reviews) })}</p>
              <p className="text-small text-ink-tertiary">{t("score.hint")}</p>
            </div>
          </AiContent>
        )}
      </Card>
      <Card title={t("next.title")}>
        <div className="flex flex-col gap-3">
          <p>{t("next.body")}</p>
          <Link to={pathTo("S18")} className={buttonClass("secondary")}>
            {t("next.practice")}
          </Link>
        </div>
      </Card>
    </div>
  );
}
