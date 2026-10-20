import i18n from "i18next";
import { initReactI18next } from "react-i18next";

/** 界面文案用文案键（ui-rules 第 6 节），先只有中文：公共文案在 zh-CN/common.json（默认命名空间），
 *  每页一个 zh-CN/<页ID>.json（命名空间就是页 ID，页面里写 useTranslation("S06")）。新加的文件自动载入。 */
export const DEFAULT_LANGUAGE = "zh-CN";

const files = import.meta.glob<Record<string, unknown>>("./zh-CN/*.json", { eager: true, import: "default" });
const namespaces = Object.fromEntries(Object.entries(files).map(([path, copy]) => [path.replace(/^.*\/|\.json$/g, ""), copy]));

void i18n.use(initReactI18next).init({
  resources: { [DEFAULT_LANGUAGE]: namespaces },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  ns: Object.keys(namespaces),
  defaultNS: "common",
  initAsync: false,
  interpolation: { escapeValue: false },
});

export { i18n };
