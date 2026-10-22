// 页头（feat:S10-11 头部状态）：名称、所属、地图来源、知识类型、范围状态、重要度、考情级、我的星标，以及“加入今日”“攻坚包”两个动作。
// 页头不放“问导师”，用顶栏与浮标（bk spec 布局说明）。叫法从词汇常量取，文案在 i18n/zh-CN/S10.json。
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { S10AddToday, S10AttackPack, S10DifficultyLevel, S10Point } from "@exam-prep/contract";
import { VOCAB } from "@exam-prep/shared/vocab";
import { Button, Icon, Importance, PageHeader, Tag } from "@exam-prep/ui";
import { useToast } from "../../../app/toast.tsx";
import { AddTodayDialog } from "./AddTodayDialog.tsx";

export interface HomeHeaderProps {
  readonly point: S10Point;
  readonly addToday: S10AddToday;
  readonly attackPack: S10AttackPack;
  /** 接口标了“示例数据”（规则还没实现，data_source 为 sample）。 */
  readonly sample: boolean;
}

export function HomeHeader({ point, addToday, attackPack, sample }: HomeHeaderProps) {
  const { t } = useTranslation("S10");
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const chapter = { no: point.chapter_no, chapter: point.chapter_name };
  const where =
    point.section_name === undefined ? t("header.path", chapter) : t("header.path_section", { ...chapter, section: point.section_name });
  return (
    <>
      <PageHeader
        title={point.name}
        eyebrow={
          <>
            <span>{where}</span>
            <span className="ml-3">{t("header.source", { source: VOCAB.knowledge_map[point.map_source] })}</span>
          </>
        }
        actions={
          <>
            {/* feat:S10-09 加入今日：先给估算耗时，并提示会挤掉今天哪一项 */}
            <Button onClick={() => setAdding(true)}>{t("header.add_today")}</Button>
            {/* feat:S10-17 攻坚包（P1）：时长由接口给（上限参数还没登记，勘误表第 11 条） */}
            <Button variant="primary" onClick={() => toast(t("soon.attack_pack"))}>
              {t("header.attack_pack", { minutes: attackPack.minutes })}
            </Button>
          </>
        }
        meta={
          <>
            {point.knowledge_types.map((type) => (
              <Tag key={type} tone="brand" size="sm">
                {VOCAB.knowledge_type[type]}
              </Tag>
            ))}
            <ImportanceMeta point={point} />
            <ExamLevelTag point={point} />
            <ScopeMeta point={point} />
            <StarToggle starred={point.starred} />
            <DifficultyTag point={point} />
            {sample && (
              <Tag tone="warning" size="sm">
                {t("sample")}
              </Tag>
            )}
          </>
        }
      />
      <AddTodayDialog open={adding} estimate={addToday} onClose={() => setAdding(false)} />
    </>
  );
}

/** feat:S10-02 双层重要度：官方或模板给默认星级，个人可覆盖（重要度、考情级、我的星标三样分开，勘误表第 14 条）。 */
function ImportanceMeta({ point }: { point: S10Point }) {
  const { t } = useTranslation("S10");
  const toast = useToast();
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-small text-ink-secondary">
      {t("header.importance")}
      <Importance level={point.importance.level} />
      {point.importance.overridden && <span>{t("header.importance_overridden", { level: point.importance.default_level })}</span>}
      <Button variant="ghost" size="sm" onClick={() => toast(t("soon.importance"))}>
        {t("header.importance_change")}
      </Button>
    </span>
  );
}

/** 考情级：冷启动不显示；考情数据不足时按重要度估算并标“按重要度估算”（bk spec 数据不足态）。 */
function ExamLevelTag({ point }: { point: S10Point }) {
  const { t } = useTranslation("S10");
  const level = point.exam_level.level;
  if (level === undefined) return null;
  return (
    <Tag tone="outline" size="sm">
      {point.exam_level.estimated ? t("header.exam_level_estimated", { level }) : t("header.exam_level", { level })}
    </Tag>
  );
}

/** feat:S10-10 范围开关：在这里移出或加回学习范围（写操作，接后端前提示“即将上线”）。 */
function ScopeMeta({ point }: { point: S10Point }) {
  const { t } = useTranslation("S10");
  const toast = useToast();
  const state = point.scope_state;
  const removed = state === "removed";
  let text = t("header.in_scope");
  if (state === "added") text = t("header.in_scope_added", { state: VOCAB.scope_state[state] });
  if (removed) text = t("header.out_of_scope", { state: VOCAB.scope_state[state] });
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Tag tone={removed ? "neutral" : "success"} size="sm">
        {text}
      </Tag>
      <Button variant="ghost" size="sm" onClick={() => toast(t("soon.scope"))}>
        {removed ? t("header.scope_add") : t("header.scope_remove")}
      </Button>
    </span>
  );
}

/** 我的星标（S10-11）：个人收藏，不改重要度、不影响今日推荐。 */
function StarToggle({ starred }: { starred: boolean }) {
  const { t } = useTranslation("S10");
  const toast = useToast();
  return (
    <Button variant="ghost" size="sm" aria-pressed={starred} icon={<Icon name="star" filled={starred} />} onClick={() => toast(t("soon.star"))}>
      {starred ? t("header.starred") : t("header.star")}
    </Button>
  );
}

/** feat:S10-16 三层难度（P1）：客观难度、同类人群难度、对你的难度；没同意个性化分析时只显示客观难度。 */
function DifficultyTag({ point }: { point: S10Point }) {
  const { t } = useTranslation("S10");
  const { difficulty } = point;
  const label = (level: S10DifficultyLevel | undefined): string =>
    level === undefined ? t("header.difficulty_unknown") : t(`difficulty.${level}`);
  const personal = difficulty.personalized ? difficulty.personal : undefined;
  const text =
    personal === undefined
      ? t("header.difficulty_objective", { level: label(difficulty.objective) })
      : t("header.difficulty_personal", { level: label(personal) });
  const title = difficulty.personalized
    ? t("header.difficulty_title", { objective: label(difficulty.objective), peer: label(difficulty.peer), personal: label(difficulty.personal) })
    : undefined;
  return (
    <Tag tone="outline" size="sm" title={title}>
      {text}
    </Tag>
  );
}
