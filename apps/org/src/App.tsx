import { useTranslation } from "react-i18next";

/** 占位应用：本端在后续分期开放，0.1b 只显示“尚未开放”。 */
export function App() {
  const { t } = useTranslation();
  return (
    <main className="min-h-dvh bg-bg-canvas font-sans text-body text-ink-secondary">
      <p>{t("app.notOpen")}</p>
    </main>
  );
}
