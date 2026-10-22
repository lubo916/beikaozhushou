import { useGetO02Leads } from "@exam-prep/contract";
import { useLocation } from "../../router/history.tsx";
import { leadsView, shouldRetry } from "./view.ts";

export function useLeads() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const query = useGetO02Leads(
    { exam: params.get("exam") ?? "kj", state: params.get("state") ?? "normal" },
    { query: { retry: shouldRetry } },
  );
  return { ...leadsView(query), retry: () => void query.refetch() };
}
