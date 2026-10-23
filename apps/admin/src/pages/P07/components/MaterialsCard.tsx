import { useTranslation } from "react-i18next";
import type { P07Material, P07Pipeline } from "@exam-prep/contract";
import { formatCount } from "@exam-prep/shared";
import { AiContent, Button, Card, List, Tag, type TagTone } from "@exam-prep/ui";

type Stage = P07Material["stage"];
/** 步骤先后：版面分析 → 切片 → 知识点挂载 → 已完成；只用来给步骤标签上色，不算业务数字。 */
const ORDER: readonly Stage[] = ["layout", "slicing", "mounting", "done"];
const STEPS: readonly Stage[] = ["layout", "slicing", "mounting"];

function stepState(current: Stage, step: Stage): "done" | "now" | "next" {
  const now = ORDER.indexOf(current);
  const at = ORDER.indexOf(step);
  if (now > at) return "done";
  return now === at ? "now" : "next";
}

const STEP_TONE: Readonly<Record<"done" | "now" | "next", TagTone>> = { done: "success", now: "brand", next: "outline" };

// feat:P07-01 教材与讲义处理：版面分析、切片、知识点挂载三步，页数、切片与挂载计数由接口给；AI 查重与挂载建议带 AI 标识。
export function MaterialsCard({ data, onSoon }: { data: P07Pipeline; onSoon: () => void }) {
  const { t } = useTranslation("P07");
  return (
    <Card title={t("materials.title")} meta={t("materials.meta")}>
      {data.materials.length === 0 ? (
        <p className="text-small text-ink-tertiary">{t("materials.none")}</p>
      ) : (
        <List>
          {data.materials.map((material) => (
            <li key={material.id} className="flex flex-col gap-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{material.title}</strong>
                <Tag size="sm" tone="outline">
                  {t(`materials.kinds.${material.material_kind}`)}
                </Tag>
                {material.stage === "done" && (
                  <Tag size="sm" tone="success">
                    {t("materials.stages.done")}
                  </Tag>
                )}
              </div>
              <ol aria-label={t("materials.steps")} className="flex flex-wrap gap-1">
                {STEPS.map((step) => {
                  const state = stepState(material.stage, step);
                  return (
                    <li key={step} aria-current={state === "now" ? "step" : undefined}>
                      <Tag size="sm" tone={STEP_TONE[state]}>
                        {t(`materials.stages.${step}`)}
                        <span className="ui-visually-hidden">{t(`materials.step.${state}`)}</span>
                      </Tag>
                    </li>
                  );
                })}
              </ol>
              <span className="text-small text-ink-tertiary">
                {t("materials.counts", {
                  pages: formatCount(material.page_count),
                  slices: formatCount(material.slice_count),
                  mounted: formatCount(material.mounted_count),
                })}
              </span>
              {material.duplicate_count > 0 && (
                <span>
                  <Tag size="sm" tone="warning">
                    {t("materials.duplicates", { n: formatCount(material.duplicate_count) })}
                  </Tag>
                </span>
              )}
              {material.ai_note !== undefined && <AiContent note={t("materials.aiNote")}>{material.ai_note}</AiContent>}
              <span>
                <Button size="sm" onClick={onSoon}>
                  {t("materials.open")}
                </Button>
              </span>
            </li>
          ))}
        </List>
      )}
    </Card>
  );
}
