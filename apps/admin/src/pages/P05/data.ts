// P05 的数据钩子：只经生成的请求函数（getP05ExamAnalysis）与本页假数据层拿数；按来源筛选由接口完成。
// 取数沿用 W01 的平台后台临时数据桥（P01/runtime.ts，只引用不修改）；整合任务补齐查询依赖后换成生成的钩子。
import { getP05ExamAnalysis, type GetP05ExamAnalysisParams, type P05ExamAnalysis, type P05SourceLevel } from "@exam-prep/contract";
import { requestThroughMock, usePageQuery, type MockHandler } from "../P01/runtime.ts";
import { analysisView, shouldRetry } from "./view.ts";

export type SourceFilter = "all" | P05SourceLevel;
export const SOURCES: readonly P05SourceLevel[] = ["official_public", "licensed", "recalled"];

const mockHandler = (): Promise<MockHandler> => import("../../mocks/pages/P05.ts").then((module) => module.handleP05);

function loadAnalysis(query: string, signal: AbortSignal): Promise<P05ExamAnalysis> {
  const params = Object.fromEntries(new URLSearchParams(query)) as GetP05ExamAnalysisParams;
  return requestThroughMock("/admin/exam-analysis", query, signal, mockHandler, () => getP05ExamAnalysis(params, { signal }));
}

export interface AnalysisFilters {
  /** 演示考试（开发与测试时由 ?exam= 切换）。 */
  readonly exam: string;
  /** 强制页面状态（开发与测试时由 ?state= 传给假数据层）。 */
  readonly state: string;
  readonly source: SourceFilter;
}

export function useExamAnalysis(filters: AnalysisFilters) {
  const search = new URLSearchParams({ exam: filters.exam, state: filters.state });
  if (filters.source !== "all") search.set("source", filters.source);
  const query = usePageQuery(search.toString(), loadAnalysis, shouldRetry);
  return { ...analysisView(query), retry: query.refetch };
}
