import { useTranslation } from "react-i18next";
import { Route, Routes } from "react-router";

/** 学员端骨架：0.1b 只有一个页面，外壳、导航与页面状态由 PLAT-01 加入（页面清单见 generated/pages.ts）。 */
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
      <h1 className="text-title font-bold">{t("app.title")}</h1>
    </main>
  );
}
