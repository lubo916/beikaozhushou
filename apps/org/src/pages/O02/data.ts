import { getGetO02LeadsQueryKey, useGetO02Leads } from "@exam-prep/contract";
import { useLocation } from "../../router/history.tsx";
import { leadsView, shouldRetry } from "./view.ts";

export function useLeads() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const request = { exam: params.get("exam") ?? "kj", state: params.get("state") ?? "normal" };
  // 仅开发假数据的补充通道；正式接口仍使用契约 query，等待共享请求适配器整合。
  const mockRequest = import.meta.env.DEV ? { headers: { "X-O02-Demo-Query": new URLSearchParams(request).toString() } } : undefined;
  const query = useGetO02Leads(request, { query: { queryKey: getGetO02LeadsQueryKey(request), retry: shouldRetry }, request: mockRequest });
  return { ...leadsView(query), retry: () => void query.refetch() };
}
