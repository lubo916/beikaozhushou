// 规则（feat:S04-09）：不显示对错、不出现导师与提示（feat:S04-04）；每题选把握度，不会就选“不会”（feat:S04-05）；
// 主观题先作答再对照得分点（feat:S04-11）；可以分次完成、再次诊断只升不降、摸底错题不自动进错题本（feat:S04-07、S04-12、S04-13）。
// 有没做完的会话时（接口给 assessment_restricted），在规则上面加一条受限说明：测评中不出现导师、提示与推送。
import { useTranslation } from "react-i18next";
import { Card, PageState } from "@exam-prep/ui";
import { InfoList } from "./InfoList.tsx";

const RULES = ["no_reveal", "confidence", "subjective", "resume"] as const;

export function RulesCard({ restricted }: { readonly restricted: boolean }) {
  const { t } = useTranslation("S04");
  const rows = RULES.map((key) => ({ key, title: t(`rules.${key}.title`), body: t(`rules.${key}.body`) }));
  return (
    <Card title={t("rules.title")}>
      <div className="flex flex-col gap-3">
        {restricted && <PageState state="restricted" compact title={t("state.restricted.title")} body={t("state.restricted.body")} />}
        <InfoList rows={rows} />
      </div>
    </Card>
  );
}
