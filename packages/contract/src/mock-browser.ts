// 浏览器假数据的 MSW 接线（api-rules 第 4、5 节）：把 /api/v1 下的请求交给学员端假数据层的 handle 函数，
// 由它决定回 JSON、空响应、断网、一直加载，还是放行到真接口（VITE_REAL）。
// msw 是本包的开发依赖：只在开发与测试模式下经 apps/<端>/src/mocks/ 动态加载，正式构建不含。
import { HttpResponse, delay, http, passthrough } from "msw";
import { setupWorker } from "msw/browser";
import { API_BASE_PATH } from "./fetcher.ts";

export interface MockRequest {
  readonly method: string;
  /** 完整地址（含查询串）。 */
  readonly url: string;
  readonly headers: Headers;
  /** 已解析的 JSON 请求体；没有请求体时为 undefined。 */
  readonly body: unknown;
}

export type MockOutcome =
  | { readonly kind: "json"; readonly status: number; readonly body: unknown; readonly headers: Readonly<Record<string, string>> }
  | { readonly kind: "empty"; readonly status: number; readonly headers: Readonly<Record<string, string>> }
  | { readonly kind: "network_error" }
  | { readonly kind: "hang" }
  | { readonly kind: "passthrough" };

export type MockHandle = (request: MockRequest) => Promise<MockOutcome>;

/** Service Worker 脚本的地址：pnpm gen 把它复制到各端的 public/（packages/codegen 的 msw 目标）。 */
export const MOCK_WORKER_URL = "/mockServiceWorker.js";

async function readBody(request: Request): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const text = await request.clone().text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** 启动浏览器里的 MSW；返回停止函数。没被 handle 接住的请求照常发出（onUnhandledRequest: bypass）。 */
export async function startMockWorker(handle: MockHandle): Promise<() => void> {
  const worker = setupWorker(
    http.all(`*${API_BASE_PATH}/*`, async ({ request }) => {
      const body = await readBody(request);
      const outcome = await handle({ method: request.method, url: request.url, headers: request.headers, body });
      switch (outcome.kind) {
        case "passthrough":
          return passthrough();
        case "network_error":
          return HttpResponse.error();
        case "hang":
          await delay("infinite");
          return undefined;
        case "empty":
          return new HttpResponse(null, { status: outcome.status, headers: { ...outcome.headers } });
        case "json":
          return new HttpResponse(JSON.stringify(outcome.body), {
            status: outcome.status,
            headers: { "content-type": "application/json", ...outcome.headers },
          });
      }
    }),
  );
  await worker.start({ onUnhandledRequest: "bypass", quiet: true, serviceWorker: { url: MOCK_WORKER_URL } });
  return () => worker.stop();
}
