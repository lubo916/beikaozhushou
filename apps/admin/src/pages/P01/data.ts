// P01 的数据钩子：只经生成的请求函数（getP01Cockpit）与本页假数据层拿数，业务数字都由接口给。
import { getP01Cockpit, type GetP01CockpitParams, type P01Cockpit, type P01CohortDimension } from "@exam-prep/contract";
import { requestThroughMock, usePageQuery, type MockHandler } from "./runtime.ts";
import { cockpitView, shouldRetry } from "./view.ts";

/** 默认看地图来源分群（与原型一致）。 */
export const DEFAULT_DIMENSION: P01CohortDimension = "map_source";
export const DIMENSIONS: readonly P01CohortDimension[] = ["goal_type", "map_source", "channel"];

const mockHandler = (): Promise<MockHandler> => import("../../mocks/pages/P01.ts").then((module) => module.handleP01);

function loadCockpit(query: string, signal: AbortSignal): Promise<P01Cockpit> {
  const params = Object.fromEntries(new URLSearchParams(query)) as GetP01CockpitParams;
  return requestThroughMock("/admin/cockpit", query, signal, mockHandler, () => getP01Cockpit(params, { signal }));
}

export interface CockpitFilters {
  /** 演示考试（开发与测试时由 ?exam= 切换）。 */
  readonly exam: string;
  /** 强制页面状态（开发与测试时由 ?state= 传给假数据层）。 */
  readonly state: string;
  readonly dimension: P01CohortDimension;
}

export function useCockpit(filters: CockpitFilters) {
  const key = new URLSearchParams({ exam: filters.exam, state: filters.state, dimension: filters.dimension }).toString();
  const query = usePageQuery(key, loadCockpit, shouldRetry);
  return { ...cockpitView(query), retry: query.refetch };
}
