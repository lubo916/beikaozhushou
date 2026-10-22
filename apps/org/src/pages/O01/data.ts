import { useGetO01Workbench, type GetO01WorkbenchParams } from "@exam-prep/contract";
import { workbenchView, shouldRetry } from "./view.ts";

export function useWorkbench(params: GetO01WorkbenchParams) {
  const query = useGetO01Workbench(params, { query: { retry: shouldRetry } });
  return { ...workbenchView(query), retry: () => void query.refetch() };
}
