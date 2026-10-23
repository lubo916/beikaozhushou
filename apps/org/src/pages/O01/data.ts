import { getGetO01WorkbenchQueryKey, useGetO01Workbench, type GetO01WorkbenchParams } from "@exam-prep/contract";
import { workbenchView, shouldRetry } from "./view.ts";

export function useWorkbench(params: GetO01WorkbenchParams) {
  // 当前 fetch 适配未传出 query。阶段 1 仅在开发模拟通道携带演示条件，真实接口整合后移除。
  const request = import.meta.env.DEV ? { headers: { "X-O01-Demo-Query": new URLSearchParams(params).toString() } } : undefined;
  const query = useGetO01Workbench(params, { query: { queryKey: getGetO01WorkbenchQueryKey(params), retry: shouldRetry }, request });
  return { ...workbenchView(query), retry: () => void query.refetch() };
}
