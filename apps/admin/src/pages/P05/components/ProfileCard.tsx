import { useTranslation } from "react-i18next";
import type { P05ExamAnalysis, P05ProfileEntry } from "@exam-prep/contract";
import { formatCount, formatDateTime, formatScore } from "@exam-prep/shared";
import { vocabLabel } from "@exam-prep/shared/vocab";
import { AiContent, KeyValueList, PageState, Tag, Card, type KeyValueItem } from "@exam-prep/ui";

function ProfileEntry({ entry }: { entry: P05ProfileEntry }) {
  const { t } = useTranslation("P05");
  const list = (values: readonly string[]) => values.join(t("profile.listSeparator"));
  // 成熟中只返回原始次数；其余字段接口给了才显示（页面不推算）。
  const items: KeyValueItem[] = [
    {
      key: "frequency",
      label: t("profile.frequency"),
      value: t("profile.frequencyValue", { years: entry.year_count, n: entry.appearance_count }),
    },
  ];
  if (entry.total_score !== undefined) items.push({ key: "score", label: t("profile.score"), value: formatScore(entry.total_score) });
  if (entry.question_types !== undefined) items.push({ key: "types", label: t("profile.types"), value: list(entry.question_types) });
  if (entry.angles !== undefined) items.push({ key: "angles", label: t("profile.angles"), value: list(entry.angles) });
  if (entry.trend !== undefined) items.push({ key: "trend", label: t("profile.trend"), value: t(`trend.${entry.trend}`) });
  if (entry.traps !== undefined)
    items.push({ key: "traps", label: t("profile.traps"), value: list(entry.traps.map((trap) => vocabLabel("trap_type", trap))) });
  const details = <KeyValueList items={items} />;
  return (
    <li className="flex flex-col gap-2 rounded-md border border-line-soft p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{entry.name}</strong>
        <Tag size="sm" tone={entry.status === "published" ? "success" : "warning"}>
          {t(`profile.status.${entry.status}`)}
        </Tag>
      </div>
      {entry.ai_draft ? <AiContent note={t("profile.aiNote")}>{details}</AiContent> : details}
    </li>
  );
}

// feat:P05-04 考点档案生成：考频、分值、题型、角度、趋势、陷阱；新真题入库后增量重算（时间与新入库数由接口给）。
// 冷启动（样本不足）不出结论，只显示原始计数；成熟中只列出现次数。
export function ProfileCard({ data }: { data: P05ExamAnalysis }) {
  const { t } = useTranslation("P05");
  const profile = data.profile;
  return (
    <Card title={t("profile.title")}>
      {profile.sample_sufficient ? (
        <div className="flex flex-col gap-3">
          <p className="text-small text-ink-secondary">{t(`profile.level.${data.maturity.level}`)}</p>
          {profile.recomputed_at !== undefined && (
            <p className="text-small text-ink-tertiary">
              {t("profile.recomputed", {
                time: formatDateTime(profile.recomputed_at, data.time_zone),
                n: formatCount(profile.new_question_count ?? 0),
              })}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {profile.entries.map((entry) => (
              <ProfileEntry key={entry.kp_id} entry={entry} />
            ))}
          </ul>
        </div>
      ) : (
        <PageState
          compact
          state="insufficient_data"
          title={t("state.insufficient_data.title")}
          body={t("state.insufficient_data.body")}
          counts={[
            { key: "questions", label: t("profile.questions"), value: formatCount(profile.question_count) },
            { key: "years", label: t("profile.years"), value: formatCount(data.maturity.year_count) },
            { key: "minimum", label: t("profile.minimum"), value: formatCount(profile.minimum_question_count) },
          ]}
          missing={t("profile.insufficientMissing")}
        />
      )}
    </Card>
  );
}
