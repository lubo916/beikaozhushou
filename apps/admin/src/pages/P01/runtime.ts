// 平台后台首批页面的临时数据桥（P01、P02 共用，整合任务接管）：后台还没登记查询依赖（@tanstack/react-query），
// 也没有假数据工作线程（mockServiceWorker.js），生成的 useGetXxx 钩子暂时跑不起来。这里只用生成的请求函数与 ApiError：
// 开发与测试时把请求交给本页假数据处理器（与 MSW 处理器同签名），正式构建走生成的请求函数。
// 整合任务补齐后，data.ts 把 usePageQuery 换成生成的钩子即可，页面组件与七态判断不用改（见 W01 交接单）。
import { useCallback, useEffect, useState } from "react";
import { API_BASE_PATH, toApiError } from "@exam-prep/contract";
import type { MockOutcome, MockRequest } from "@exam-prep/contract/mock-browser";

export type MockHandler = (request: MockRequest) => Promise<MockOutcome>;

/** 与 TanStack Query 查询结果同名同义的几个字段：七态判断只看这些。 */
export interface PageQuery<T> {
  readonly data: T | undefined;
  readonly error: unknown;
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
}

/** 重试前等一会儿：网络或服务异常再试一次，约一秒出结果（F08-Q3）。 */
const RETRY_DELAY_MS = 1000;
const HTTP_OK_FIRST = 200;
const HTTP_OK_LAST = 299;

function waitForAbort<T>(signal: AbortSignal): Promise<T> {
  return new Promise<T>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

/** 开发与测试（VITE_MOCKS 没关）时经本页假数据处理器取数；否则走生成的请求函数。 */
export async function requestThroughMock<T>(
  path: string,
  query: string,
  signal: AbortSignal,
  handler: () => Promise<MockHandler>,
  real: () => Promise<T>,
): Promise<T> {
  if (!import.meta.env.DEV || import.meta.env["VITE_MOCKS"] === "off") return real();
  const handle = await handler();
  const url = new URL(`${API_BASE_PATH}${path}${query === "" ? "" : `?${query}`}`, window.location.origin).href;
  const outcome = await handle({ method: "GET", url, headers: new Headers(), body: undefined });
  const ok = (status: number) => status >= HTTP_OK_FIRST && status <= HTTP_OK_LAST;
  switch (outcome.kind) {
    case "json":
      if (ok(outcome.status)) return outcome.body as T;
      throw toApiError(outcome.status, outcome.body);
    case "empty":
      if (ok(outcome.status)) return undefined as T;
      throw toApiError(outcome.status, undefined);
    case "network_error":
      throw new TypeError("Failed to fetch");
    case "hang":
      return waitForAbort<T>(signal);
    case "passthrough":
      return real();
  }
}

/** 取一次数（key 变了或调用 refetch 时重取）；断网时暂停，联网后自动重取。load 与 retry 要传模块级函数。 */
export function usePageQuery<T>(
  key: string,
  load: (key: string, signal: AbortSignal) => Promise<T>,
  retry: (failureCount: number, error: unknown) => boolean,
): PageQuery<T> & { readonly refetch: () => void } {
  const [result, setResult] = useState<PageQuery<T>>({ data: undefined, error: null, status: "pending", fetchStatus: "fetching" });
  const [round, setRound] = useState(0);
  useEffect(() => {
    const reconnect = () => setRound((value) => value + 1);
    if (!navigator.onLine) {
      setResult((previous) => ({ ...previous, fetchStatus: "paused" }));
      window.addEventListener("online", reconnect, { once: true });
      return () => window.removeEventListener("online", reconnect);
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setResult((previous) => ({
      ...previous,
      error: null,
      fetchStatus: "fetching",
      status: previous.data === undefined ? "pending" : previous.status,
    }));
    const attempt = (failures: number) => {
      load(key, controller.signal).then(
        (data) => {
          if (!controller.signal.aborted) setResult({ data, error: null, status: "success", fetchStatus: "idle" });
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          if (retry(failures, error)) {
            timer = setTimeout(() => attempt(failures + 1), RETRY_DELAY_MS);
            return;
          }
          setResult((previous) => ({ data: previous.data, error, status: "error", fetchStatus: "idle" }));
        },
      );
    };
    attempt(0);
    return () => {
      controller.abort();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [key, round, load, retry]);
  const refetch = useCallback(() => setRound((value) => value + 1), []);
  return { ...result, refetch };
}
