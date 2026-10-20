import { useTranslation } from "react-i18next";
import { Route, Routes } from "react-router";

/** 学员端骨架：占位页显示产品名“备考助手”；外壳、导航与页面状态由 PLAT-01 加入（页面清单见 generated/pages.ts，由 pnpm gen 生成）。 */
export function App() {
  return (
    <Routes>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

function Home() {
  const { t } = useTranslation();
  return (
    <main className="min-h-dvh bg-bg-canvas font-sans text-body text-ink-primary">
      <p>{t("app.product")}</p>
      <h1 className="text-title font-bold">{t("app.title")}</h1>
      <p>{t("app.placeholder")}</p>
    </main>
  );
}
