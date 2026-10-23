// P06 的数据钩子：只经生成的请求函数（getP06ChangeImpact）与本页假数据层拿数；按变更类型筛选由接口完成。
// 取数沿用 W01 的平台后台临时数据桥（P01/runtime.ts，只引用不修改）；整合任务补齐查询依赖后换成生成的钩子。
import { getP06ChangeImpact, type GetP06ChangeImpactParams, type P06ChangeImpact, type P06ChangeKind } from "@exam-prep/contract";
import { requestThroughMock, usePageQuery, type MockHandler } from "../P01/runtime.ts";
import { impactView, shouldRetry } from "./view.ts";

export type KindFilter = "all" | P06ChangeKind;
export const KINDS: readonly P06ChangeKind[] = ["syllabus", "textbook", "rule"];

const mockHandler = (): Promise<MockHandler> => import("../../mocks/pages/P06.ts").then((module) => module.handleP06);

function loadImpact(query: string, signal: AbortSignal): Promise<P06ChangeImpact> {
  const params = Object.fromEntries(new URLSearchParams(query)) as GetP06ChangeImpactParams;
  return requestThroughMock("/admin/change-impact", query, signal, mockHandler, () => getP06ChangeImpact(params, { signal }));
}

export interface ImpactFilters {
  /** 演示考试（开发与测试时由 ?exam= 切换）。 */
  readonly exam: string;
  /** 强制页面状态（开发与测试时由 ?state= 传给假数据层）。 */
  readonly state: string;
  readonly kind: KindFilter;
}

export function useChangeImpact(filters: ImpactFilters) {
  const search = new URLSearchParams({ exam: filters.exam, state: filters.state });
  if (filters.kind !== "all") search.set("kind", filters.kind);
  const query = usePageQuery(search.toString(), loadImpact, shouldRetry);
  return { ...impactView(query), retry: query.refetch };
}
