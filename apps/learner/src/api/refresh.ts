// 数据刷新（api-rules 第 6 节）：写操作成功后，按契约里的 x-invalidates（生成的接口一览 OPERATIONS 带着它）让受影响的查询失效。
// 生成钩子的查询键第一项是接口路径（如 /practice/mistakes、/exams/<考试 ID>/map），这里按路径模板匹配。
import type { QueryClient } from "@tanstack/react-query";
import { OPERATIONS, type OperationId } from "@exam-prep/contract";

const PARAM_SEGMENT = /^\{\w+\}$/;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");

/** 查询键的第一项是否是这个接口的路径（带不带 /api/v1 前缀都算）。 */
export function matchesOperation(operationId: OperationId, firstKey: unknown): boolean {
  if (typeof firstKey !== "string") return false;
  const pattern = OPERATIONS[operationId].path
    .split("/")
    .map((segment) => (PARAM_SEGMENT.test(segment) ? "[^/]+" : escapeRegExp(segment)))
    .join("/");
  return new RegExp(`${pattern}$`).test(firstKey.split("?")[0] ?? "");
}

/** 写操作成功后调用：让它在契约里声明会影响的查询失效（用到这些数据的页面会自动重新取）。 */
export function invalidateAfter(queryClient: QueryClient, operationId: OperationId): Promise<void> {
  const targets: readonly OperationId[] = OPERATIONS[operationId].invalidates;
  return queryClient.invalidateQueries({ predicate: (query) => targets.some((target) => matchesOperation(target, query.queryKey[0])) });
}
