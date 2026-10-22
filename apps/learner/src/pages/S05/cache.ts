// feat:S05-01 只保存生成钩子最近一次成功报告；按用户、目标、考试和视图隔离本次会话。
import type { MeContext, S05StartReport } from "@exam-prep/contract";
import { getStartReportResponse } from "@exam-prep/contract/zod";

type Identity = Pick<S05StartReport, "viewer_id" | "exam_id" | "target_date" | "target_score">;
const PREFIX = "bk.s05.report";
const ACTIVE = `${PREFIX}:active`;
const identitySchema = getStartReportResponse.pick({ viewer_id: true, exam_id: true, target_date: true, target_score: true });
function key(identity: Identity, view: S05StartReport["view"]): string {
  return `${PREFIX}:${JSON.stringify([identity.viewer_id, identity.exam_id, identity.target_date, identity.target_score, view])}`;
}
function matches(
  data: Identity & Pick<S05StartReport, "view" | "demo_exam_key">,
  identity: Identity,
  view: S05StartReport["view"],
  selector?: string | null,
): boolean {
  return (
    data.viewer_id === identity.viewer_id &&
    data.exam_id === identity.exam_id &&
    data.target_date === identity.target_date &&
    data.target_score === identity.target_score &&
    data.view === view &&
    (!selector || data.demo_exam_key === selector || data.exam_id === selector)
  );
}
export function storeReport(report: S05StartReport): void {
  const parsed = getStartReportResponse.safeParse(report);
  if (!parsed.success || !parsed.data.available) return;
  try {
    sessionStorage.setItem(key(parsed.data, parsed.data.view), JSON.stringify(parsed.data));
    sessionStorage.setItem(ACTIVE, JSON.stringify(identitySchema.parse(parsed.data)));
  } catch {
    // 浏览器禁用存储或空间不足时，仍可查看当前请求得到的报告。
  }
}
/** 服务器明确拒绝身份或报告后，使本页离线缓存失效；不触碰其他页面的存储。 */
export function clearReportCache(): void {
  try {
    for (const entry of Object.keys(sessionStorage)) {
      if (entry.startsWith(`${PREFIX}:`)) sessionStorage.removeItem(entry);
    }
  } catch {
    // 存储被禁用时仍由页面的权限态阻止读取旧报告。
  }
}
export function restoreReport(
  view: S05StartReport["view"],
  context: MeContext | undefined,
  selector?: string | null,
  allowSavedIdentity = false,
): S05StartReport | undefined {
  try {
    let identity: Identity;
    if (context !== undefined) {
      if (context.goal === undefined) return undefined;
      identity = {
        viewer_id: context.user.id,
        exam_id: context.goal.exam_id,
        target_date: context.goal.target_date,
        target_score: context.goal.target_score,
      };
    } else {
      if (!allowSavedIdentity) return undefined;
      const saved = identitySchema.safeParse(JSON.parse(sessionStorage.getItem(ACTIVE) ?? "null"));
      if (!saved.success) return undefined;
      identity = saved.data;
    }
    const entry = key(identity, view);
    const parsed = getStartReportResponse.safeParse(JSON.parse(sessionStorage.getItem(entry) ?? "null"));
    if (!parsed.success || !parsed.data.available || !matches(parsed.data, identity, view, selector)) return undefined;
    // JSON 中不存在 undefined；生成 Zod 的可选类型比生成接口类型宽。
    return parsed.data as S05StartReport;
  } catch {
    // 无缓存、损坏缓存或存储不可用，统一交给页面的无缓存离线退路。
    return undefined;
  }
}
