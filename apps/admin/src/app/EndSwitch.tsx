// 平台后台顶栏的环境标识：当前是开发、测试、预发还是生产环境（构建模式即环境名，见 vite.config.ts），防止在生产环境误操作。
import { useTranslation } from "react-i18next";

const ENVS = ["development", "test", "staging", "production"] as const;

export function EndSwitch() {
  const { t } = useTranslation();
  const env = ENVS.find((name) => name === import.meta.env.MODE) ?? "development";
  return (
    <span className="inline-flex min-w-[0] shrink items-center gap-2 rounded-full border border-line-strong bg-bg-sunk py-1 pr-3 pl-1 text-small">
      <span className="truncate rounded-full bg-brand-primary px-2 py-1 font-bold text-bg-surface">{t(`shell.switch.envs.${env}`)}</span>
      <span className="hidden shrink-0 @tablet:inline">{t("shell.switch.hint")}</span>
    </span>
  );
}
