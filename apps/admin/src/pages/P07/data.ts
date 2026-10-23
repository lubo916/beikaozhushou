// P07 的数据钩子：只经生成的请求函数（getP07Pipeline）与本页假数据层拿数；排序、计数与差异分段都由接口给。
// 数据桥与 P01、P02 共用 ../P01/runtime.ts（整合任务补齐后台查询依赖后，这里改用生成的 useGetP07Pipeline，见 W04 交接单）。
import { getP07Pipeline, type GetP07PipelineParams, type P07Pipeline, type P07ReviewKind } from "@exam-prep/contract";
import { requestThroughMock, usePageQuery, type MockHandler } from "../P01/runtime.ts";
import { pipelineView, shouldRetry } from "./view.ts";

export type KindFilter = "all" | P07ReviewKind;
export const KINDS: readonly P07ReviewKind[] = ["solution", "card", "slice_mount"];

const mockHandler = (): Promise<MockHandler> => import("../../mocks/pages/P07.ts").then((module) => module.handleP07);

function loadPipeline(query: string, signal: AbortSignal): Promise<P07Pipeline> {
  const params = Object.fromEntries(new URLSearchParams(query)) as GetP07PipelineParams;
  return requestThroughMock("/admin/pipeline", query, signal, mockHandler, () => getP07Pipeline(params, { signal }));
}

export interface PipelineFilters {
  /** 演示考试（开发与测试时由 ?exam= 切换）。 */
  readonly exam: string;
  /** 强制页面状态（开发与测试时由 ?state= 传给假数据层）。 */
  readonly state: string;
  /** 审核台的条目类型筛选（由接口筛）。 */
  readonly kind: KindFilter;
}

export function usePipeline(filters: PipelineFilters) {
  const search = new URLSearchParams({ exam: filters.exam, state: filters.state });
  if (filters.kind !== "all") search.set("kind", filters.kind);
  const query = usePageQuery(search.toString(), loadPipeline, shouldRetry);
  return { ...pipelineView(query), retry: query.refetch };
}
