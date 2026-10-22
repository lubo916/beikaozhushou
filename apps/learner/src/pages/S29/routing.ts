import type { S29Result } from "@exam-prep/contract";
import { pathTo } from "../../routes.ts";
export function resultPath(item: S29Result): string {
  return pathTo(item.target, { kpId: item.target_id, docId: item.target_id, sessionId: item.target_id });
}
