import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { DevControl } from "../control.ts";
import type { MockDb } from "../db.ts";
import type { DemoFixtures } from "../demo.ts";
import { DevToolbar } from "./DevToolbar.tsx";

export interface DevToolbarMount {
  readonly queryClient: QueryClient;
  readonly control: DevControl;
  readonly db: MockDb;
  readonly fixtures: DemoFixtures;
  readonly failure: string | null;
}

/** 开发工具条挂在页面之外的独立节点上（不进路由与页面）；组件陈列页 /dev/ui 不挂，陈列页的检查不受影响。 */
export function mountDevToolbar({ queryClient, ...props }: DevToolbarMount): void {
  if (window.location.pathname.startsWith("/dev/")) return;
  const host = document.createElement("div");
  host.id = "bk-dev-toolbar";
  document.body.append(host);
  createRoot(host).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <DevToolbar {...props} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
