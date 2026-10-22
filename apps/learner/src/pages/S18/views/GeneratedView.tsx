// 视图 gen：导师出的生成题，先做后核（S18-12）：先盲答，揭晓后确认“题目没问题”才计证据。模式标签按术语表写（勘误第 6 条），
// 确认前标“待你确认”（勘误第 7 条）；题目带 AI 生成标识（红线 4）。
import { useTranslation } from "react-i18next";
import { Banner } from "@exam-prep/ui";
import { QuizRunner, type ViewProps } from "../components/QuizRunner.tsx";

export function GeneratedView(props: ViewProps) {
  const { t } = useTranslation("S18");
  return (
    <QuizRunner
      {...props}
      rule={t("side.rule_gen")}
      intro={
        <Banner tone="ai" title={t("gen.intro_title")}>
          {t("gen.intro_body")}
        </Banner>
      }
    />
  );
}
