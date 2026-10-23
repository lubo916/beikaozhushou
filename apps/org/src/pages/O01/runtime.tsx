// 机构端首次页面的临时运行桥；共享 App 装配与 Query 依赖登记由整合任务接管。
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PageState } from "@exam-prep/ui";
const client = new QueryClient();
let starting: Promise<void> | undefined;
function prepare(): Promise<void> {
  if (!import.meta.env.DEV || import.meta.env["VITE_MOCKS"] === "off") return Promise.resolve();
  starting ??= Promise.all([
    import("@exam-prep/contract/mock-browser"),
    import("../../mocks/pages/O01.ts"),
    import("../../mocks/pages/O02.ts"),
  ]).then(async ([{ startMockWorker }, { handleO01 }, { handleO02 }]) => {
    await startMockWorker(async (request) => {
      const first = await handleO01(request);
      return first.kind === "passthrough" ? handleO02(request) : first;
    });
  });
  return starting;
}
export function OrgPageRuntime({ children, pageId = "O01" }: { children: ReactNode; pageId?: "O01" | "O02" }) {
  const { t } = useTranslation(pageId);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    void prepare().then(
      () => {
        if (active) setStatus("ready");
      },
      () => {
        if (active) setStatus("error");
      },
    );
    return () => {
      active = false;
    };
  }, []);
  if (status === "error")
    return (
      <PageState
        state="error"
        pageName={t("title")}
        audience="staff"
        body={t("state.error.body")}
        onRetry={() => window.location.reload()}
      />
    );
  if (status === "loading") return <PageState state="loading" pageName={t("title")} />;
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
