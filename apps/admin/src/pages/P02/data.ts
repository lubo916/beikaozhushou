// P02 的数据钩子：只经生成的请求函数（getP02MetricDictionary）与本页假数据层拿数；筛选由接口完成。
import {
  getP02MetricDictionary,
  type GetP02MetricDictionaryParams,
  type P02MetricCategory,
  type P02MetricDictionary,
} from "@exam-prep/contract";
import { requestThroughMock, usePageQuery, type MockHandler } from "../P01/runtime.ts";
import { dictionaryView, shouldRetry } from "./view.ts";

export type CategoryFilter = "all" | P02MetricCategory;

const mockHandler = (): Promise<MockHandler> => import("../../mocks/pages/P02.ts").then((module) => module.handleP02);

function loadDictionary(query: string, signal: AbortSignal): Promise<P02MetricDictionary> {
  const params = Object.fromEntries(new URLSearchParams(query)) as GetP02MetricDictionaryParams;
  return requestThroughMock("/admin/metric-dictionary", query, signal, mockHandler, () => getP02MetricDictionary(params, { signal }));
}

export interface DictionaryFilters {
  readonly exam: string;
  readonly state: string;
  readonly category: CategoryFilter;
  readonly keyword: string;
}

export function useMetricDictionary(filters: DictionaryFilters) {
  const search = new URLSearchParams({ exam: filters.exam, state: filters.state });
  if (filters.category !== "all") search.set("category", filters.category);
  const keyword = filters.keyword.trim();
  if (keyword !== "") search.set("q", keyword);
  const query = usePageQuery(search.toString(), loadDictionary, shouldRetry);
  return { ...dictionaryView(query), retry: query.refetch };
}
