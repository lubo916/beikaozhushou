// feat:S10-04 考点档案：考频、历年分值、主要题型、考察角度、典型陷阱、趋势；按数据成熟度逐项显示——
// 冷启动不展示（本页的受限态），成熟中只显示原始次数（本页的数据不足态），可参考与成熟时显示全部。文案按 bk spec 的七态。
import { useTranslation } from "react-i18next";
import type { S10ExamProfile } from "@exam-prep/contract";
import { formatCount, formatScore } from "@exam-prep/shared/format";
import { VOCAB } from "@exam-prep/shared/vocab";
import { Card, KeyValueList, PageState, Tag, type KeyValueItem } from "@exam-prep/ui";

export function ExamProfileCard({ profile }: { profile: S10ExamProfile }) {
  const { t } = useTranslation("S10");
  if (profile.maturity === "cold") {
    return (
      <Card title={t("profile.title")}>
        <PageState state="restricted" compact title={t("profile.cold.title")} body={t("profile.cold.body")} />
      </Card>
    );
  }
  const maturity = (
    <Tag size="sm" tone={profile.maturity === "mature" ? "success" : "brand"}>
      {VOCAB.data_maturity[profile.maturity]}
    </Tag>
  );
  if (profile.maturity === "maturing") {
    const raw = profile.raw;
    const counts: KeyValueItem[] =
      raw === undefined
        ? []
        : [
            { key: "appearances", label: t("profile.maturing.appearances"), value: formatCount(raw.appearances, t("profile.unit_times")) },
            { key: "years", label: t("profile.maturing.years"), value: formatCount(raw.years_covered, t("profile.unit_years")) },
          ];
    const missing = raw?.years_missing === undefined ? undefined : t("profile.maturing.missing", { n: raw.years_missing });
    return (
      <Card title={t("profile.title")} meta={maturity}>
        <PageState
          state="insufficient_data"
          compact
          title={t("profile.maturing.title")}
          body={t("profile.maturing.body")}
          counts={counts}
          missing={missing}
        />
      </Card>
    );
  }
  const items: KeyValueItem[] = [];
  if (profile.syllabus !== undefined) items.push({ key: "syllabus", label: t("profile.syllabus"), value: profile.syllabus });
  if (profile.frequency !== undefined) {
    const value = t("profile.frequency_value", { years: profile.frequency.years, times: profile.frequency.times });
    items.push({ key: "frequency", label: t("profile.frequency"), value });
  }
  if (profile.average_score !== undefined) {
    items.push({ key: "score", label: t("profile.score"), value: t("profile.score_value", { score: formatScore(profile.average_score) }) });
  }
  if (profile.question_types !== undefined && profile.question_types.length > 0) {
    const value = profile.question_types.map((type) => `${type.name} ${formatCount(type.count)}`).join("、");
    items.push({ key: "types", label: t("profile.types"), value });
  }
  if (profile.angles !== undefined && profile.angles.length > 0) {
    items.push({ key: "angles", label: t("profile.angles"), value: profile.angles.join("、") });
  }
  if (profile.traps !== undefined && profile.traps.length > 0) {
    items.push({ key: "traps", label: t("profile.traps"), value: profile.traps.map((trap) => VOCAB.trap_type[trap]).join("、") });
  }
  if (profile.trend !== undefined) items.push({ key: "trend", label: t("profile.trend"), value: t(`profile.trend_value.${profile.trend}`) });
  const updated = profile.updated;
  return (
    <Card
      title={t("profile.title")}
      meta={maturity}
      footer={
        updated === undefined ? undefined : (
          <p className="text-small text-ink-tertiary">{t("profile.updated", { year: updated.year, month: updated.month })}</p>
        )
      }
    >
      <KeyValueList items={items} />
    </Card>
  );
}
