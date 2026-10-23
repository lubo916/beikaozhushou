// 页头（feat:S04-09 开始页）：小标题是页名“摸底诊断”，大标题“先摸个底”（原型），下面一句说明；规则还没实现时标“示例数据”。
import { useTranslation } from "react-i18next";
import { PageHeader, Tag } from "@exam-prep/ui";

export function DiagnosisHeader({ sample }: { readonly sample: boolean }) {
  const { t } = useTranslation("S04");
  const { t: tc } = useTranslation();
  return (
    <PageHeader
      eyebrow={tc("page.S04")}
      title={t("header.title")}
      description={t("header.subtitle")}
      meta={sample ? <Tag tone="outline">{t("header.sample")}</Tag> : undefined}
    />
  );
}
