import { useTranslation } from "react-i18next";
import { Card } from "@exam-prep/ui";

/** 原型主视图的“禁用表述”卡（红线 10）：只说规则，不把禁用语本身写出来。 */
export function WordingCard() {
  const { t } = useTranslation("P05");
  return (
    <Card title={t("wording.title")}>
      <p className="text-small text-ink-secondary">{t("wording.body")}</p>
    </Card>
  );
}
