// 学员端假数据层入口（api-rules 第 4、5 节）：开发与测试模式下由 main.tsx 动态加载，正式构建不含这里的代码。
// 启动顺序：读四个演示考试 → 建内存仓库与开发控制 → 自动注册 domains/ 与 pages/ 的路由 → 接上 MSW → 挂开发工具条。
// 地址里可以直接带：?exam=kj|js|en|ds 切演示考试，?state=<页面状态> 强制状态，?now=<ISO 时刻> 时间旅行（自动化测试就用这几个）。
import type { QueryClient } from "@tanstack/react-query";
import { startMockWorker } from "@exam-prep/contract/mock-browser";
import { createMockApi } from "./api.ts";
import { DevControl, parseRealDomains, type ControlStore } from "./control.ts";
import { MockDb } from "./db.ts";
import { loadDemoFixtures } from "./fixtures.ts";
import { collectRoutes, loadRouteModules } from "./registry.ts";

/** 等 Service Worker 就绪的上限；超时就先显示页面（请求会走真接口），工具条上写明原因。 */
const START_TIMEOUT_MS = 5000;

export interface StartMocksOptions {
  readonly queryClient: QueryClient;
}

function sessionStore(): ControlStore | undefined {
  try {
    const storage = window.sessionStorage;
    return {
      get: (key) => storage.getItem(key),
      set: (key, value) => storage.setItem(key, value),
      remove: (key) => storage.removeItem(key),
    };
  } catch {
    return undefined;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`等了 ${ms / 1000} 秒还没启动`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export async function startMocks({ queryClient }: StartMocksOptions): Promise<void> {
  const fixtures = loadDemoFixtures();
  const control = new DevControl({
    examKeys: fixtures.exams.map((exam) => exam.key),
    defaultExamKey: fixtures.defaultKey,
    realDomains: parseRealDomains(import.meta.env["VITE_REAL"]),
    search: () => window.location.search,
    store: sessionStore(),
  });
  const query = new URLSearchParams(window.location.search);
  const exam = query.get("exam");
  if (exam !== null && control.examKeys.includes(exam)) control.setExam(exam);
  const travel = Date.parse(query.get("now") ?? "");
  if (Number.isFinite(travel)) control.travelTo(travel);
  const db = new MockDb(fixtures);
  const api = createMockApi({ db, control, routes: collectRoutes(loadRouteModules()) });
  let failure: string | null = null;
  try {
    await withTimeout(startMockWorker(api.handle), START_TIMEOUT_MS);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
  // 自动化测试（Playwright）不挂工具条：截图与布局检查不受影响，用上面的地址参数控制
  if (navigator.webdriver) return;
  const { mountDevToolbar } = await import("./devtools/mount.tsx");
  mountDevToolbar({ queryClient, control, db, fixtures, failure });
}
