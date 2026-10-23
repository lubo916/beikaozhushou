// 外壳与页面测试的小工具（浏览器模式）：带查询客户端与内存路由挂载学员端，等按需加载的页面出来。
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import { getGetMeContextQueryKey, type MeContext } from "@exam-prep/contract";
import { createMockApi } from "../mocks/api.ts";
import { DevControl } from "../mocks/control.ts";
import { MockDb } from "../mocks/db.ts";
import { loadDemoFixtures } from "../mocks/fixtures.ts";
import { collectRoutes, loadRouteModules } from "../mocks/registry.ts";
import "../i18n/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 测试用的 /me/context：还没有目标的学员（刚进来，入门没走完）。 */
export const NO_GOAL_CONTEXT: MeContext = {
  user: { id: "0190a000-0000-7000-8000-000000000001", display_name: "陈然", is_guest: false },
  today: "2026-10-21",
  now: "2026-10-21T01:00:00Z",
  time_zone: "Asia/Shanghai",
  day_start_hour: 4,
};

/** 测试用的 /me/context：一个有目标的学员（数值是演示值，不是规则数字）。 */
export const DEMO_CONTEXT: MeContext = {
  ...NO_GOAL_CONTEXT,
  goal: {
    exam_id: "junior-accounting",
    exam_name: "初级会计职称",
    short_name: "初级会计",
    evaluation_rule: "pass_line",
    target_score: null,
    target_date: "2027-05-16",
    days_to_target: 217,
    map_id: "0190a000-0000-7000-8000-000000000002",
  },
};

/** 外壳测试接上页面实际使用的假接口；地址里的 ?state= 同步给假接口控制，不绕过生成的请求钩子。 */
export function stubDemoApi(path: string): void {
  const fixtures = loadDemoFixtures();
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    search: () => new URL(path, "http://localhost").search,
    clock: () => Date.parse(DEMO_CONTEXT.now),
  });
  const api = createMockApi({
    db: new MockDb(fixtures),
    control,
    routes: collectRoutes(loadRouteModules()),
  });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const outcome = await api.handle({
      method: init?.method ?? "GET",
      url: new URL(url, "http://localhost").href,
      headers: new Headers(init?.headers),
      body: undefined,
    });
    if (outcome.kind === "hang") return new Promise<Response>(() => undefined);
    if (outcome.kind !== "json") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { "content-type": "application/json" } });
  });
}

export interface Mounted {
  readonly host: HTMLElement;
  unmount: () => Promise<void>;
}

/** 查询客户端：不重试；给了 context 就预先放进缓存（不发请求）。 */
export function testClient(context?: MeContext): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } } });
  if (context !== undefined) client.setQueryData(getGetMeContextQueryKey(), context);
  return client;
}

export async function mount(ui: ReactNode): Promise<Mounted> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(ui));
  return {
    host,
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

/** 在 path 打开 ui（通常是 <App />）。 */
export function mountAt(path: string, ui: ReactNode, context: MeContext | undefined = DEMO_CONTEXT): Promise<Mounted> {
  return mount(
    <QueryClientProvider client={testClient(context)}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 等到条件成立（按需加载的页面要等一会儿）；每一小段等待都包在 act 里。 */
export async function settle(check: () => boolean, tries = 150): Promise<void> {
  for (let i = 0; i < tries && !check(); i += 1) {
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));
  }
}

export async function click(element: Element | null | undefined): Promise<void> {
  if (!(element instanceof HTMLElement)) throw new Error("找不到要点的元素");
  await act(async () => element.click());
}

/** 页面的 h1 文字。 */
export function heading(host: ParentNode): string | undefined {
  return host.querySelector("h1")?.textContent ?? undefined;
}

export function linkByText(root: ParentNode | null | undefined, text: string): HTMLAnchorElement | undefined {
  return [...(root?.querySelectorAll<HTMLAnchorElement>("a") ?? [])].find((link) => link.textContent?.trim() === text);
}
