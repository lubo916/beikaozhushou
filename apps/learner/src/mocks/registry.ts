// 假数据路由自动注册（api-rules 第 3 节）：pages/<页ID>.ts 一页一个文件，domains/<领域>.ts 一个领域一个文件，
// 文件里导出 routes 就会被收上来，不用改这里。同一个接口写了两次、或写了契约里没有的接口，直接报错。
import { OPERATIONS } from "@exam-prep/contract/operations";
import type { MockRoute } from "./route.ts";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export function collectRoutes(modules: Readonly<Record<string, unknown>>): MockRoute[] {
  const routes: MockRoute[] = [];
  const seen = new Map<string, string>();
  for (const file of Object.keys(modules).sort()) {
    const list = isRecord(modules[file]) ? (modules[file] as Record<string, unknown>)["routes"] : undefined;
    if (!Array.isArray(list)) throw new Error(`${file} 要导出 routes（defineRoute 的列表）`);
    for (const route of list as MockRoute[]) {
      if (!Object.hasOwn(OPERATIONS, route.operationId)) throw new Error(`${file}：契约里没有接口 ${route.operationId}`);
      const previous = seen.get(route.operationId);
      if (previous !== undefined) throw new Error(`接口 ${route.operationId} 的假数据写了两次：${previous} 与 ${file}`);
      seen.set(route.operationId, file);
      routes.push(route);
    }
  }
  return routes;
}

/** 读 domains/ 与 pages/ 下的路由文件（Vite 的 import.meta.glob；测试文件不算）。 */
export function loadRouteModules(): Record<string, unknown> {
  return {
    ...import.meta.glob(["./domains/*.ts", "!./domains/*.test.ts"], { eager: true }),
    ...import.meta.glob(["./pages/*.ts", "!./pages/*.test.ts"], { eager: true }),
  };
}
