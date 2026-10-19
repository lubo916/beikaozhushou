import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zhCN from "./zh-CN.json";

/** 界面文案用文案键（docs/conventions/copy.md 规则 1），先只有中文。 */
export const DEFAULT_LANGUAGE = "zh-CN";

void i18n.use(initReactI18next).init({
  resources: { [DEFAULT_LANGUAGE]: { translation: zhCN } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  initAsync: false,
  interpolation: { escapeValue: false },
});

export { i18n };
