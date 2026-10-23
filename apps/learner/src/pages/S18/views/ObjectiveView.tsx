// 视图 obj：题库里的题（客观题）。做题主流程见 components/QuizRunner.tsx。
import { useTranslation } from "react-i18next";
import { QuizRunner, type ViewProps } from "../components/QuizRunner.tsx";

export function ObjectiveView(props: ViewProps) {
  const { t } = useTranslation("S18");
  return <QuizRunner {...props} rule={t("side.rule_obj")} />;
}
